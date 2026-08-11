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

// الاتصال بقاعدة البيانات
connectDB();

// أمان أساسي على مستوى الـ HTTP headers
app.use(helmet({ crossOriginResourcePolicy: false }));

// -------------------------------------------------------------
// إعدادات CORS الذكية (تسمح بأي رابط من Vercel + القيمة المحددة في CLIENT_ORIGIN)
// -------------------------------------------------------------
app.use(
  cors({
    origin: function (origin, callback) {
      // السماح بالطلبات التي ليس لها origin (مثل تطبيقات الهاتف أو Postman)
      if (!origin) return callback(null, true);

      const clientOrigin = process.env.CLIENT_ORIGIN;

      // السماح إذا كان Origin يطابق CLIENT_ORIGIN أو ينتهي بـ .vercel.app
      if (
        origin === clientOrigin ||
        origin.endsWith('.vercel.app') ||
        clientOrigin === '*'
      ) {
        return callback(null, true);
      } else {
        return callback(null, true); // إتاحة الوصول لكل المصادر لضمان عدم حظر الـ Preview
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json({ limit: '2mb' }));

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

// حد على الـ heartbeat
const heartbeatLimiter = rateLimit({
  windowMs: 60 * 1000, // دقيقة واحدة
  max: 6,
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

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 خادم مجلة ورقة يعمل الآن على المنفذ ${PORT}`);
  });
}

module.exports = app;
