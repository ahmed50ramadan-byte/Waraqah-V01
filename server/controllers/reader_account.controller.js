const Reader = require('../models/Reader');

// PUT /api/readers/account (محمي: قارئ) - تعديل البريد الإلكتروني و/أو كلمة السر
// يتطلب كلمة السر الحالية للتحقق قبل أي تعديل، سواء كان التعديل على الإيميل أو الباسورد
async function updateAccount(req, res, next) {
  try {
    const { currentPassword, newEmail, newPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ message: 'يرجى إدخال كلمة السر الحالية للتأكيد.' });
    }

    const reader = req.reader;
    const isMatch = await reader.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'كلمة السر الحالية غير صحيحة.' });
    }

    if (newEmail && newEmail.trim()) {
      const normalizedEmail = newEmail.trim().toLowerCase();
      if (normalizedEmail !== reader.email) {
        const existing = await Reader.findOne({ email: normalizedEmail });
        if (existing) {
          return res.status(409).json({ message: 'هذا البريد الإلكتروني مستخدم بالفعل لحساب آخر.' });
        }
        reader.email = normalizedEmail;
      }
    }

    if (newPassword && newPassword.trim()) {
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'كلمة السر الجديدة يجب أن تكون 6 أحرف على الأقل.' });
      }
      reader.passwordHash = await Reader.hashPassword(newPassword);
    }

    await reader.save();
    res.json({ reader, message: 'تم تحديث بيانات الحساب بنجاح.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { updateAccount };
