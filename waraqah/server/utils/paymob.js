const axios = require('axios');

const PAYMOB_BASE_URL = 'https://accept.paymob.com/api';

// المرحلة 1: الحصول على توكن مصادقة مؤقت من Paymob
async function getAuthToken() {
  const response = await axios.post(`${PAYMOB_BASE_URL}/auth/tokens`, {
    api_key: process.env.PAYMOB_API_KEY
  });
  return response.data.token;
}

// المرحلة 2: إنشاء طلب دفع (Order) على Paymob
async function createOrder(authToken, amountCents, merchantOrderId) {
  const response = await axios.post(`${PAYMOB_BASE_URL}/ecommerce/orders`, {
    auth_token: authToken,
    delivery_needed: false,
    amount_cents: amountCents,
    currency: 'EGP',
    merchant_order_id: merchantOrderId,
    items: []
  });
  return response.data;
}

// المرحلة 3: الحصول على مفتاح الدفع (Payment Key) - يختلف حسب نوع التكامل (كارت أو محفظة)
async function getPaymentKey(authToken, orderId, amountCents, integrationId, billingData) {
  const response = await axios.post(`${PAYMOB_BASE_URL}/acceptance/payment_keys`, {
    auth_token: authToken,
    amount_cents: amountCents,
    expiration: 3600,
    order_id: orderId,
    billing_data: billingData,
    currency: 'EGP',
    integration_id: integrationId
  });
  return response.data.token;
}

// المرحلة 4أ (كارت): يرجع رابط الـ iframe اللي المستخدم هيدخل بيانات الكارت فيه
function buildCardIframeUrl(paymentToken) {
  return `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;
}

// المرحلة 4ب (محفظة إلكترونية): بيبدأ عملية الدفع بالمحفظة ويرجع رابط تأكيد الدفع (OTP)
async function payWithWallet(paymentToken, walletNumber) {
  const response = await axios.post(`${PAYMOB_BASE_URL}/acceptance/payments/pay`, {
    source: {
      identifier: walletNumber,
      subtype: 'WALLET'
    },
    payment_token: paymentToken
  });
  return response.data;
}

function defaultBillingData(reader) {
  // Paymob محتاج بيانات فوترة كاملة، وبما إننا مش بناخد عنوان فعلي من القارئ، بنستخدم بيانات عامة صالحة
  return {
    apartment: 'NA',
    email: reader.email,
    floor: 'NA',
    first_name: reader.name.split(' ')[0] || reader.name,
    street: 'NA',
    building: 'NA',
    phone_number: 'NA',
    shipping_method: 'NA',
    postal_code: 'NA',
    city: 'Cairo',
    country: 'EG',
    last_name: reader.name.split(' ').slice(1).join(' ') || reader.name,
    state: 'Cairo'
  };
}

module.exports = {
  getAuthToken,
  createOrder,
  getPaymentKey,
  buildCardIframeUrl,
  payWithWallet,
  defaultBillingData
};
