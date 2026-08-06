const Reader = require('../models/Reader');
const PointsTransaction = require('../models/PointsTransaction');
const { awardPoints, todayStr } = require('../utils/pointsEngine');
const { getRankForTotal, getNextRankInfo, RANKS } = require('../utils/ranks');

const DAILY_ACTIVE_SECONDS_CAP = 20 * 60; // 20 دقيقة = 1200 ثانية (سقف يومي لمكافأة الوقت النشط)
const READ_ARTICLE_THRESHOLD_SECONDS = 120; // دقيقتين داخل المقال عشان تتحسب "قراءة مكتملة"

function yesterdayStr() {
  return new Date(Date.now() - 86400000).toISOString().split('T')[0];
}

// يتعامل مع منطق سلسلة القراءة اليومية (Daily Streak) ويمنح بونص الـ 7 أيام
async function handleReadStreak(reader, today) {
  if (reader.lastReadBonusDate === today) return; // القراءة المكتملة الأولى في اليوم فقط تحسب للسلسلة

  if (reader.lastReadBonusDate === yesterdayStr()) {
    reader.readStreakCount = (reader.readStreakCount || 0) + 1;
  } else {
    reader.readStreakCount = 1;
  }
  reader.lastReadBonusDate = today;
  await reader.save();

  if (reader.readStreakCount >= 7) {
    reader.readStreakCount = 0; // إعادة العدّاد لدورة جديدة
    await reader.save();
    await awardPoints(reader, 50, 'read_streak', 'بونص سلسلة القراءة اليومية (7 أيام متتالية).');
  }
}

// POST /api/points/heartbeat (محمي: قارئ)
// بيُستدعى كل ~20 ثانية من الواجهة فقط أثناء كون الصفحة نشطة (visible) والمستخدم متفاعل فعليًا.
// كل التحقق والحساب هنا سيرفري بالكامل - مفيش أي رقم نقاط جاهز بييجي من الفرونت إند.
async function heartbeat(req, res, next) {
  try {
    const { articleId, seconds } = req.body;
    const numSeconds = Number(seconds);

    // رفض أي قيمة غير منطقية (حماية من التلاعب بإرسال قفزات وقت كبيرة)
    if (!numSeconds || numSeconds <= 0 || numSeconds > 30) {
      return res.status(400).json({ message: 'قيمة الوقت المرسلة غير صالحة.' });
    }

    const reader = req.reader;
    const today = todayStr();
    reader.resetDailyCountersIfNeeded(today);

    // --- 1) مكافأة الوقت النشط العامة (+2 لكل دقيقة، سقف 20 دقيقة/يوم) ---
    const remainingAllowed = Math.max(0, DAILY_ACTIVE_SECONDS_CAP - reader.dailyActiveSecondsAccumulated);
    const secondsToCount = Math.min(numSeconds, remainingAllowed);
    reader.dailyActiveSecondsAccumulated += secondsToCount;

    const minutesAccumulated = Math.floor(reader.dailyActiveSecondsAccumulated / 60);
    const newMinutesToReward = minutesAccumulated - reader.dailyActiveMinutesRewarded;

    let earnedThisTick = 0;
    if (newMinutesToReward > 0) {
      reader.dailyActiveMinutesRewarded = minutesAccumulated;
      await reader.save();
      const pointsToAward = newMinutesToReward * 2;
      await awardPoints(reader, pointsToAward, 'active_time', `مكافأة وقت نشط (${newMinutesToReward} دقيقة).`);
      earnedThisTick += pointsToAward;
    }

    // --- 2) مكافأة قراءة مقال كامل (+5 مرة واحدة لكل مقال في اليوم، بشرط 120 ثانية) ---
    let readArticleBonusAwarded = false;
    if (articleId) {
      const isSameSession =
        reader.currentArticleProgress &&
        reader.currentArticleProgress.articleId === articleId &&
        reader.currentArticleProgress.date === today;

      if (!isSameSession) {
        reader.currentArticleProgress = { articleId, seconds: 0, date: today };
      }
      reader.currentArticleProgress.seconds += numSeconds;

      const alreadyRewardedToday = reader.dailyArticlesReadRewarded.includes(articleId);
      if (!alreadyRewardedToday && reader.currentArticleProgress.seconds >= READ_ARTICLE_THRESHOLD_SECONDS) {
        reader.dailyArticlesReadRewarded.push(articleId);
        await reader.save();
        await awardPoints(reader, 5, 'read_article', 'مكافأة قراءة مقال كامل.', articleId);
        readArticleBonusAwarded = true;
        await handleReadStreak(reader, today);
      } else {
        await reader.save();
      }
    } else {
      await reader.save();
    }

    res.json({
      waraqBalance: reader.waraqBalance,
      waraqTotalEarned: reader.waraqTotalEarned,
      earnedThisTick,
      readArticleBonusAwarded
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/points/me (محمي: قارئ) - ملخص كامل لرصيد ورتبة القارئ
async function getPointsProfile(req, res, next) {
  try {
    const reader = req.reader;
    const rank = getRankForTotal(reader.waraqTotalEarned);
    const { next: nextRank, remaining } = getNextRankInfo(reader.waraqTotalEarned);

    res.json({
      waraqBalance: reader.waraqBalance,
      waraqTotalEarned: reader.waraqTotalEarned,
      rank,
      nextRank,
      pointsToNextRank: remaining,
      referralCode: reader.referralCode,
      allRanks: RANKS
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/points/history (محمي: قارئ) - آخر 50 حركة نقاط
async function getPointsHistory(req, res, next) {
  try {
    const transactions = await PointsTransaction.find({ reader: req.reader._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
}

module.exports = { heartbeat, getPointsProfile, getPointsHistory };
