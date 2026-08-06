function notFound(req, res, next) {
  res.status(404).json({ message: 'المسار المطلوب غير موجود.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  // أخطاء التحقق من صحة بيانات Mongoose
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(' | ') });
  }

  // خطأ تكرار مفتاح فريد (مثل اسم مستخدم أو بريد مكرر)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'الحقل';
    return res.status(409).json({ message: `${field} مستخدم بالفعل.` });
  }

  const status = err.statusCode || 500;
  res.status(status).json({ message: err.message || 'حدث خطأ غير متوقع في الخادم.' });
}

module.exports = { notFound, errorHandler };
