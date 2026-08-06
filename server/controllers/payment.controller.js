const crypto = require('crypto');
const GoldSubscriptionOrder = require('../models/GoldSubscriptionOrder');
const Reader = require('../models/Reader');
const AuditLog = require('../models/AuditLog');
const paymob = require('../utils/paymob');

function getAmountCents() {
  const priceEgp = Number(process.env.GOLD_MEMBERSHIP_PRICE_EGP) || 100;
  return Math.round(priceEgp * 100);
}

// POST /api/payment/gold/card (محمي: قارئ) - يبدأ عملية دفع بالفيزا/الماستركارد ويرجع رابط الـ iframe
async function initiateCardPayment(req, res, next) {
  try {
    const reader = req.reader;
    const amountCents = getAmountCents();
    const merchantOrderId = `GOLD-${reader._id}-${Date.now()}`;

    const authToken = await paymob.getAuthToken();
    const order = await paymob.createOrder(authToken, amountCents, merchantOrderId);
    const paymentToken = await paymob.getPaymentKey(
      authToken,
      order.id,
      amountCents,
      process.env.PAYMOB_INTEGRATION_ID_CARD,
      paymob.defaultBillingData(reader)
    );

    await GoldSubscriptionOrder.create({
      reader: reader._id,
      merchantOrderId,
      paymobOrderId: order.id,
      amountCents,
      paymentMethod: 'card',
      status: 'pending'
    });

    res.json({ iframeUrl: paymob.buildCardIframeUrl(paymentToken) });
  } catch (err) {
    console.error('خطأ Paymob (كارت):', err.response ? err.response.data : err.message);
    res.status(500).json({ message: 'تعذّر بدء عملية الدفع بالكارت حاليًا. تأكد من إعدادات Paymob في .env.' });
  }
}

// POST /api/payment/gold/wallet (محمي: قارئ) - body: { walletNumber } - يبدأ دفع بمحفظة إلكترونية
async function initiateWalletPayment(req, res, next) {
  try {
    const { walletNumber } = req.body;
    if (!walletNumber || !/^01[0-9]{9}$/.test(walletNumber)) {
      return res.status(400).json({ message: 'يرجى إدخال رقم محفظة مصري صحيح (يبدأ بـ 01 ومكوّن من 11 رقم).' });
    }

    const reader = req.reader;
    const amountCents = getAmountCents();
    const merchantOrderId = `GOLD-${reader._id}-${Date.now()}`;

    const authToken = await paymob.getAuthToken();
    const order = await paymob.createOrder(authToken, amountCents, merchantOrderId);
    const paymentToken = await paymob.getPaymentKey(
      authToken,
      order.id,
      amountCents,
      process.env.PAYMOB_INTEGRATION_ID_WALLET,
      paymob.defaultBillingData(reader)
    );

    const walletResult = await paymob.payWithWallet(paymentToken, walletNumber);

    await GoldSubscriptionOrder.create({
      reader: reader._id,
      merchantOrderId,
      paymobOrderId: order.id,
      amountCents,
      paymentMethod: 'wallet',
      walletNumber,
      status: 'pending'
    });

    // Paymob بيرجع رابط تأكيد الدفع (Redirect URL) اللي فيه القارئ هيوافق من تطبيق المحفظة (OTP)
    res.json({ redirectUrl: walletResult.redirect_url || null, rawResponse: walletResult });
  } catch (err) {
    console.error('خطأ Paymob (محفظة):', err.response ? err.response.data : err.message);
    res.status(500).json({ message: 'تعذّر بدء عملية الدفع بالمحفظة حاليًا. تأكد من إعدادات Paymob في .env.' });
  }
}

// POST /api/payment/webhook (عام - Paymob هو اللي بينادي عليه) - يتحقق من التوقيع HMAC ويفعّل العضوية عند النجاح
async function paymobWebhook(req, res, next) {
  try {
    const data = req.body;
    const obj = data.obj || data;

    // التحقق من صحة الإشعار عن طريق HMAC (يمنع أي حد يزوّر إشعار دفع وهمي)
    const receivedHmac = req.query.hmac;
    if (process.env.PAYMOB_HMAC_SECRET && receivedHmac) {
      const orderedFields = [
        obj.amount_cents, obj.created_at, obj.currency, obj.error_occured, obj.has_parent_transaction,
        obj.id, obj.integration_id, obj.is_3d_secure, obj.is_auth, obj.is_capture, obj.is_refunded,
        obj.is_standalone_payment, obj.is_voided, obj.order && obj.order.id, obj.owner, obj.pending,
        obj.source_data && obj.source_data.pan, obj.source_data && obj.source_data.sub_type,
        obj.source_data && obj.source_data.type, obj.success
      ].map((v) => (v === undefined || v === null ? '' : v)).join('');

      const computedHmac = crypto
        .createHmac('sha512', process.env.PAYMOB_HMAC_SECRET)
        .update(orderedFields)
        .digest('hex');

      if (computedHmac !== receivedHmac) {
        console.warn('⚠️ إشعار Paymob فشل في التحقق من HMAC - تم تجاهله.');
        return res.status(401).json({ message: 'توقيع غير صالح.' });
      }
    }

    const paymobOrderId = obj.order && obj.order.id;
    const isSuccess = obj.success === true || obj.success === 'true';

    const order = await GoldSubscriptionOrder.findOne({ paymobOrderId: String(paymobOrderId) });
    if (!order) {
      console.warn('⚠️ إشعار Paymob لطلب غير معروف:', paymobOrderId);
      return res.status(200).json({ received: true });
    }

    order.paymobTransactionId = obj.id ? String(obj.id) : null;
    order.status = isSuccess ? 'paid' : 'failed';
    await order.save();

    if (isSuccess) {
      const reader = await Reader.findById(order.reader);
      if (reader && !reader.isGoldMember) {
        reader.isGoldMember = true;
        reader.goldMembershipGrantedAt = new Date();
        await reader.save();

        await AuditLog.create({
          role: 'نظام الدفع',
          username: 'Paymob',
          note: `تم تفعيل العضوية الذهبية تلقائيًا للقارئ [${reader.name}] بعد دفع ناجح (${order.paymentMethod}).`
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('خطأ في معالجة webhook الخاص بـ Paymob:', err.message);
    res.status(500).json({ message: 'خطأ داخلي.' });
  }
}

// GET /api/payment/gold/status (محمي: قارئ) - لفحص حالة آخر عملية دفع (تستخدمها الواجهة للـ polling)
async function getMyLatestOrderStatus(req, res, next) {
  try {
    const order = await GoldSubscriptionOrder.findOne({ reader: req.reader._id }).sort({ createdAt: -1 });
    res.json({ order, isGoldMember: req.reader.isGoldMember });
  } catch (err) {
    next(err);
  }
}

module.exports = { initiateCardPayment, initiateWalletPayment, paymobWebhook, getMyLatestOrderStatus };
