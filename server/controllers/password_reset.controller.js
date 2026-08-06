const crypto = require('crypto');
const Reader = require('../models/Reader');
const { sendPasswordResetEmail } = require('../utils/email');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// POST /api/readers/forgot-password (عام)
async function requestPasswordReset(req, res, next) {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'يرجى إدخال البريد الإلكتروني.' });
    }

    const reader = await Reader.findOne({ email: email.trim().toLowerCase() });

    // لأسباب أمنية، نرجع نفس الرسالة سواء الإيميل موجود أو لأ (منمنعش اكتشاف الإيميلات المسجلة)
    const genericMessage = 'لو البريد الإلكتروني ده مسجل عندنا، هيوصلك رابط إعادة تعيين كلمة السر خلال لحظات.';

    if (!reader) {
      return res.json({ message: genericMessage });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    reader.resetPasswordTokenHash = hashToken(rawToken);
    reader.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // ساعة واحدة
    await reader.save();

    try {
      await sendPasswordResetEmail(reader.email, reader.name, rawToken);
    } catch (emailErr) {
      console.error('فشل إرسال إيميل استعادة كلمة السر:', emailErr.message);
      return res.status(500).json({ message: 'تعذّر إرسال إيميل استعادة كلمة السر حاليًا. حاول لاحقًا.' });
    }

    res.json({ message: genericMessage });
  } catch (err) {
    next(err);
  }
}

// POST /api/readers/reset-password (عام) - body: { token, newPassword }
async function confirmPasswordReset(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'الرمز وكلمة السر الجديدة مطلوبان.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'كلمة السر الجديدة يجب أن تكون 6 أحرف على الأقل.' });
    }

    const tokenHash = hashToken(token);
    const reader = await Reader.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!reader) {
      return res.status(400).json({ message: 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا.' });
    }

    reader.passwordHash = await Reader.hashPassword(newPassword);
    reader.resetPasswordTokenHash = null;
    reader.resetPasswordExpires = null;
    await reader.save();

    res.json({ message: 'تم تغيير كلمة السر بنجاح! تقدر تسجّل دخولك الآن بكلمة السر الجديدة.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { requestPasswordReset, confirmPasswordReset };
