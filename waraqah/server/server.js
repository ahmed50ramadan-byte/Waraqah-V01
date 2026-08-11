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

// أمان أساسي مع إيقاف حظر المصادر الخارجية لمنع التعارض مع CORS
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false
  })
);

// -------------------------------------------------------------
// إعدادات CORS الديناميكية لمنع مشكلة الملاحة بين روابط Vercel Preview
// -------------------------------------------------------------
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // إرجاع نفس الـ Origin الوارد بالطلب لدعم كافة دومينات Vercel بدون تعارض
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  // التعامل السريع مع طلبات الـ Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));

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
