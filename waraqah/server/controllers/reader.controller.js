const Reader = require('../models/Reader');
const generateToken = require('../utils/generateToken');
const { awardPoints, todayStr } = require('../utils/pointsEngine');
const { getRankForTotal, getNextRankInfo } = require('../utils/ranks');

// ينشئ كود إحالة فريد (يعيد المحاولة لو تصادف تكرار نادر)
async function createUniqueReferralCode() {
  let code;
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 5) {
    code = Reader.generateReferralCode();
    exists = await Reader.findOne({ referralCode: code });
    attempts += 1;
  }
  return code;
}

// POST /api/readers/register
async function registerReader(req, res, next) {
  try {
    const { name, email, password, referralCode } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'الاسم والبريد الإلكتروني وكلمة السر مطلوبون.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'كلمة السر يجب أن تكون 6 أحرف على الأقل.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await Reader.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: 'هذا البريد الإلكتروني مسجل بالفعل.' });
    }

    // لو دخل بكود إحالة صحيح، اربطه بصاحب الكود
    let referrer = null;
    if (referralCode && referralCode.trim()) {
      referrer = await Reader.findOne({ referralCode: referralCode.trim().toUpperCase() });
    }

    const passwordHash = await Reader.hashPassword(password);
    const myReferralCode = await createUniqueReferralCode();

    const reader = await Reader.create({
      name,
      email: normalizedEmail,
      passwordHash,
      referralCode: myReferralCode,
      referredBy: referrer ? referrer._id : null,
      dailyStatsDate: todayStr(),
      lastLoginBonusDate: todayStr()
    });

    // مكافأة الترحيب (+100 مرة واحدة فقط)
    await awardPoints(reader, 100, 'welcome_bonus', 'مكافأة إنشاء حساب جديد.');

    // مكافأة الإحالة لصاحب الكود (+50) - تُحسب فور تفعيل الصديق لحسابه (أي فور التسجيل الناجح)
    if (referrer) {
      await awardPoints(referrer, 50, 'referral', `دعوة صديق: انضم [${reader.name}] عبر كود الإحالة.`);
    }

    const token = generateToken(reader._id, 'reader');
    res.status(201).json({ reader, token, welcomeBonus: 100 });
  } catch (err) {
    next(err);
  }
}

// POST /api/readers/login
async function loginReader(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'البريد الإلكتروني وكلمة السر مطلوبان.' });
    }

    const reader = await Reader.findOne({ email: email.trim().toLowerCase() });
    if (!reader) {
      return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة السر غير صحيحة.' });
    }

    const isMatch = await reader.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'البريد الإلكتروني أو كلمة السر غير صحيحة.' });
    }

    // مكافأة الدخول اليومي (+5) - مرة واحدة كل يوم تقويمي جديد
    let dailyBonusAwarded = false;
    const today = todayStr();
    if (reader.lastLoginBonusDate !== today) {
      reader.lastLoginBonusDate = today;
      await reader.save();
      await awardPoints(reader, 5, 'daily_login', 'مكافأة تسجيل الدخول اليومي.');
      dailyBonusAwarded = true;
    }

    const token = generateToken(reader._id, 'reader');
    res.json({ reader, token, dailyBonusAwarded });
  } catch (err) {
    next(err);
  }
}

// GET /api/readers/me (محمي)
async function getReaderProfile(req, res, next) {
  try {
    const rank = getRankForTotal(req.reader.waraqTotalEarned);
    const nextRankInfo = getNextRankInfo(req.reader.waraqTotalEarned);
    res.json({
      reader: req.reader,
      rank,
      nextRank: nextRankInfo.next,
      pointsToNextRank: nextRankInfo.remaining
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { registerReader, loginReader, getReaderProfile };
