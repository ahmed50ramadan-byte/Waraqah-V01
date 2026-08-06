const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Reader = require('../models/Reader');

/**
 * يتحقق من رمز JWT الخاص بالموظفين ويربط req.user بالمستخدم الحالي.
 * يرفض الطلب إذا لم يوجد رمز صالح.
 */
async function protectStaff(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'غير مصرح: يرجى تسجيل الدخول أولاً.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'staff') {
      return res.status(401).json({ message: 'رمز دخول غير صالح لهذا المسار.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'المستخدم غير موجود، ربما تم حذف الحساب.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'رمز الدخول غير صالح أو منتهي الصلاحية.' });
  }
}

/**
 * يتحقق من رمز JWT الخاص بالقرّاء. مطلوب لعمليات مثل التقييم.
 */
async function protectReader(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'يرجى تسجيل الدخول كقارئ أولاً.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'reader') {
      return res.status(401).json({ message: 'رمز دخول غير صالح لهذا المسار.' });
    }

    const reader = await Reader.findById(decoded.id);
    if (!reader) {
      return res.status(401).json({ message: 'الحساب غير موجود.' });
    }

    req.reader = reader;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'رمز الدخول غير صالح أو منتهي الصلاحية.' });
  }
}

/**
 * مثل protectReader لكن لا يفشل الطلب إذا لم يوجد قارئ مسجّل دخول -
 * يُستخدم لصفحات القراءة العامة التي تحتاج معرفة هل القارئ مسجل أم لا
 * (لإظهار/قفل المحتوى الحصري) بدون إجبار تسجيل الدخول.
 */
async function optionalReader(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type === 'reader') {
        const reader = await Reader.findById(decoded.id);
        if (reader) req.reader = reader;
      }
    }
  } catch (err) {
    // رمز غير صالح في مسار اختياري - نتجاهله ونكمل كزائر عادي
  }
  next();
}

/**
 * Middleware factory: يسمح فقط للأدوار المذكورة بالمرور.
 * لازم يُستخدم بعد protectStaff.
 */
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'لا تملك الصلاحية الكافية لتنفيذ هذا الإجراء.' });
    }
    next();
  };
}

module.exports = { protectStaff, protectReader, optionalReader, requireRoles };
