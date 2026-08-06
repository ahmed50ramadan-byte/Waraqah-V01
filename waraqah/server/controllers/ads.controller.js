const Ad = require('../models/Ad');
const AuditLog = require('../models/AuditLog');
const { awardPoints } = require('../utils/pointsEngine');
const { safeDeleteFromCloudinary } = require('../utils/cloudinary');

// GET /api/ads (عام) - كل الإعلانات النشطة
async function getActiveAds(req, res, next) {
  try {
    const ads = await Ad.find({ active: true }).sort({ createdAt: -1 });
    res.json({ ads });
  } catch (err) {
    next(err);
  }
}

// GET /api/ads/all (محمي: SETTINGS_MANAGER_ROLES) - كل الإعلانات حتى الموقوفة (لوحة الإدارة)
async function getAllAds(req, res, next) {
  try {
    const ads = await Ad.find().sort({ createdAt: -1 });
    res.json({ ads });
  } catch (err) {
    next(err);
  }
}

// POST /api/ads (محمي: SETTINGS_MANAGER_ROLES) - صورة/نص/رابط كلهم اختياريين، بس لازم واحد منهم على الأقل
async function createAd(req, res, next) {
  try {
    const { text, linkUrl } = req.body;
    const imageUrl = req.file ? req.file.path : null;

    if (!imageUrl && (!text || !text.trim()) && (!linkUrl || !linkUrl.trim())) {
      return res.status(400).json({ message: 'يجب إضافة صورة أو نص أو رابط على الأقل للإعلان.' });
    }

    const ad = await Ad.create({
      imageUrl,
      text: (text || '').trim(),
      linkUrl: (linkUrl || '').trim()
    });

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: 'تمت إضافة إعلان جديد.'
    });

    res.status(201).json({ ad });
  } catch (err) {
    next(err);
  }
}

// PUT /api/ads/:id (محمي: SETTINGS_MANAGER_ROLES)
async function updateAd(req, res, next) {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ message: 'الإعلان غير موجود.' });

    const { text, linkUrl, active } = req.body;
    if (text !== undefined) ad.text = text.trim();
    if (linkUrl !== undefined) ad.linkUrl = linkUrl.trim();
    if (active !== undefined) ad.active = active === 'true' || active === true;

    if (req.file) {
      if (ad.imageUrl) {
        await safeDeleteFromCloudinary(ad.imageUrl, 'image');
      }
      ad.imageUrl = req.file.path;
    }

    if (!ad.imageUrl && !ad.text.trim() && !ad.linkUrl.trim()) {
      return res.status(400).json({ message: 'يجب أن يحتفظ الإعلان بصورة أو نص أو رابط على الأقل.' });
    }

    await ad.save();
    res.json({ ad });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/ads/:id (محمي: SETTINGS_MANAGER_ROLES)
async function deleteAd(req, res, next) {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ message: 'الإعلان غير موجود.' });

    if (ad.imageUrl) {
      await safeDeleteFromCloudinary(ad.imageUrl, 'image');
    }
    await ad.deleteOne();

    res.json({ message: 'تم حذف الإعلان.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/ads/:id/click (عام + قارئ اختياري) - يسجّل النقرة دايمًا، ويمنح +1 ورق مرة واحدة فقط لكل إعلان لكل قارئ
async function recordAdClick(req, res, next) {
  try {
    const ad = await Ad.findOne({ _id: req.params.id, active: true });
    if (!ad) return res.status(404).json({ message: 'الإعلان غير موجود.' });

    ad.clicksCount = (ad.clicksCount || 0) + 1;
    await ad.save();

    let earned = 0;
    if (req.reader) {
      const alreadyRewarded = req.reader.rewardedClickedAds.some((id) => id.toString() === ad._id.toString());
      if (!alreadyRewarded) {
        req.reader.rewardedClickedAds.push(ad._id);
        await req.reader.save();
        await awardPoints(req.reader, 1, 'ad_click', 'مكافأة النقر على إعلان.', null);
        earned = 1;
      }
    }

    res.json({ earned, linkUrl: ad.linkUrl });
  } catch (err) {
    next(err);
  }
}

module.exports = { getActiveAds, getAllAds, createAd, updateAd, deleteAd, recordAdClick };
