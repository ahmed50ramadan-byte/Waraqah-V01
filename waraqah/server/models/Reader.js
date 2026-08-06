const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const readerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'الاسم مطلوب'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'البريد الإلكتروني مطلوب'],
      unique: true,
      trim: true,
      lowercase: true
    },
    passwordHash: {
      type: String,
      required: true
    },

    // =========================================================
    // نظام "ورق" - نقاط ولاء القارئ
    // =========================================================

    // الرصيد القابل للصرف (بينقص عند استبدال الهدايا)
    waraqBalance: { type: Number, default: 0, min: 0 },

    // إجمالي ما تم كسبه طوال الوقت (لا ينقص أبدًا) - أساس حساب الرتبة
    waraqTotalEarned: { type: Number, default: 0, min: 0 },

    // العضوية الذهبية المدفوعة (تُمنح يدويًا من لوحة الإدارة حتى يتم ربط بوابة دفع فعلية)
    isGoldMember: { type: Boolean, default: false },
    goldMembershipGrantedAt: { type: Date, default: null },

    // استعادة كلمة السر عبر البريد الإلكتروني
    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    // كود إحالة فريد لكل قارئ لدعوة أصدقاء
    referralCode: { type: String, unique: true, sparse: true },

    // من قام بدعوة هذا القارئ (لو دخل بكود إحالة عند التسجيل)
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Reader', default: null },

    // شارات مكتسبة (قارئ مميز، قارئ نشط، ...)
    badges: { type: [String], default: [] },

    // -------- تتبع مكافأة الدخول اليومي + سلسلة القراءة --------
    lastLoginBonusDate: { type: String, default: null }, // تاريخ بصيغة YYYY-MM-DD
    readStreakCount: { type: Number, default: 0 },
    lastReadBonusDate: { type: String, default: null }, // آخر يوم اتسجّل فيه "قراءة مكتملة"

    // -------- حدود يومية لمنع الغش (تُصفّر يوميًا) --------
    dailyStatsDate: { type: String, default: null }, // اليوم اللي بتخص بياناته السطور اللي تحت
    dailyActiveSecondsAccumulated: { type: Number, default: 0 }, // ثواني نشاط متراكمة (تصفير يومي)
    dailyActiveMinutesRewarded: { type: Number, default: 0 }, // دقايق اتكافأت عليها اليوم (حد أقصى 20)
    dailyCommentsCount: { type: Number, default: 0 }, // تعليقات اليوم (حد أقصى 2)
    dailyArticlesReadRewarded: { type: [String], default: [] }, // معرفات مقالات اتكافأ عليها اليوم (منع تكرار +5 لنفس المقال في نفس اليوم)

    // تقدّم قراءة المقال المفتوح حاليًا (لحساب لحظة الوصول لـ 120 ثانية)
    currentArticleProgress: {
      articleId: { type: String, default: null },
      seconds: { type: Number, default: 0 },
      date: { type: String, default: null }
    },

    // منع تكرار مكافأة الإعجاب/المشاركة لنفس المقال (دائم، لا يُصفّر يوميًا)
    rewardedLikedArticles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Article' }],
    rewardedSharedArticles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Article' }],

    // منع تكرار مكافأة النقر على نفس الإعلان (دائم، لا يُصفّر يوميًا)
    rewardedClickedAds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ad' }]
  },
  { timestamps: true }
);

readerSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

readerSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
};

// ينشئ كود إحالة فريد وقصير مبني على الاسم + أحرف عشوائية
readerSchema.statics.generateReferralCode = function () {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

// يعيد تصفير العدادات اليومية لو تغيّر اليوم (يُستدعى في أول أي عملية كسب نقاط)
readerSchema.methods.resetDailyCountersIfNeeded = function (todayStr) {
  if (this.dailyStatsDate !== todayStr) {
    this.dailyStatsDate = todayStr;
    this.dailyActiveSecondsAccumulated = 0;
    this.dailyActiveMinutesRewarded = 0;
    this.dailyCommentsCount = 0;
    this.dailyArticlesReadRewarded = [];
  }
};

readerSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    return ret;
  }
});

module.exports = mongoose.model('Reader', readerSchema);
