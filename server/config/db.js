const mongoose = require('mongoose');

// بنخزّن الاتصال (Connection) في متغيّر عالمي عشان لو Vercel أعاد استخدام نفس
// الـ Container الدافئ (Warm Instance) لطلب تاني، منعملش اتصال جديد بقاعدة البيانات
// من الصفر في كل مرة - ده أهم فرق لازم يتعمل عشان الأداء يبقى معقول على Serverless.
let cachedConnectionPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    // متصل بالفعل (Warm Instance) - مفيش داعي نعمل حاجة
    return mongoose.connection;
  }

  if (cachedConnectionPromise) {
    return cachedConnectionPromise;
  }

  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI غير موجود في ملف .env');
    throw new Error('MONGO_URI غير موجود في ملف .env');
  }

  cachedConnectionPromise = mongoose
    .connect(process.env.MONGO_URI)
    .then((conn) => {
      console.log('✅ تم الاتصال بقاعدة بيانات MongoDB بنجاح.');
      return conn;
    })
    .catch((err) => {
      console.error('❌ فشل الاتصال بقاعدة البيانات:', err.message);
      cachedConnectionPromise = null; // نسمح بمحاولة تانية في الطلب اللي بعده بدل ما نفضل عالقين
      // على السيرفر التقليدي (مش Vercel) بنوقف العملية فورًا لأن مفيش معنى نكمل من غير قاعدة بيانات
      if (!process.env.VERCEL) {
        process.exit(1);
      }
      throw err;
    });

  return cachedConnectionPromise;
}

module.exports = connectDB;
