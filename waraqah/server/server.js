require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const readerRoutes = require('./routes/reader.routes');
const articleRoutes = require('./routes/article.routes');
const commentsRoutes = require('./routes/comments.routes');
const teamRoutes = require('./routes/team.routes');
const auditRoutes = require('./routes/audit.routes');
const settingsRoutes = require('./routes/settings.routes');
const pointsRoutes = require('./routes/points.routes');
const rewardsRoutes = require('./routes/rewards.routes');
const adsRoutes = require('./routes/ads.routes');
const paymentRoutes = require('./routes/payment.routes');

const app = express();

// الاتصال بقاعدة البيانات (config/db.js بقى ذكي: بيعيد استخدام نفس الاتصال
// لو الدالة اتنادت أكتر من مرة، وده مهم جدًا في بيئة Serverless زي Vercel)
connectDB();

// أمان أساسي على مستوى الـ HTTP headers
app.use(helmet({ crossOriginResourcePolicy: false }));

// السماح للواجهة الأمامية بالوصول للـ API
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || '*'
  })
);

app.use(express.json({ limit: '2mb' }));

// ملاحظة: ملفات الصور/الصوتيات بقت متخزنة على Cloudinary مش على القرص المحلي،
// فمحتاجين نقدّم /uploads محليًا (كانت موجودة قبل كده لما كان التخزين محلي).

// حد لعدد محاولات تسجيل الدخول/التسجيل لمنع الهجمات (Brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 30,
  message: { message: 'عدد محاولات كبير جدًا، يرجى المحاولة لاحقًا.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth', authLimiter);
app.use('/api/readers/login', authLimiter);
app.use('/api/readers/register', authLimiter);
app.use('/api/readers/forgot-password', authLimiter);

// حد أخف على الـ heartbeat عشان يمنع أي محاولة إغراق السيرفر بطلبات وهمية متكررة
const heartbeatLimiter = rateLimit({
  windowMs: 60 * 1000, // دقيقة واحدة
  max: 6, // نبضة كل ~20 ثانية = حد أقصى 3-4 بالدقيقة، سايبين هامش لـ 6
  message: { message: 'معدل طلبات مرتفع جدًا.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/points/heartbeat', heartbeatLimiter);

// المسارات
app.use('/api/auth', authRoutes);
app.use('/api/readers', readerRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/articles', commentsRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/payment', paymentRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'waraqah-api' }));

app.use(notFound);
app.use(errorHandler);

// على Vercel، الملف ده بيتحمّل كـ Serverless Function مش سيرفر عادي - Vercel نفسه
// بيتولى فتح المنفذ، فمينفعش نستخدم app.listen() هناك. بنفرّق باستخدام متغير
// البيئة VERCEL اللي Vercel بيحطه تلقائيًا في كل الـ deployments بتاعته.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 خادم مجلة ورقة يعمل الآن على المنفذ ${PORT}`);
  });
}

module.exports = app;
