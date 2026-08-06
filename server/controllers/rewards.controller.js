const RewardItem = require('../models/RewardItem');
const RedemptionRequest = require('../models/RedemptionRequest');
const AuditLog = require('../models/AuditLog');
const { deductPoints } = require('../utils/pointsEngine');
const { safeDeleteFromCloudinary } = require('../utils/cloudinary');

// GET /api/rewards (عام) - كتالوج الهدايا النشطة فقط
async function getActiveCatalog(req, res, next) {
  try {
    const items = await RewardItem.find({ active: true }).sort({ pointsCost: 1 });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// GET /api/rewards/all (محمي: SETTINGS_MANAGER_ROLES) - كل الهدايا حتى غير النشطة (لوحة الإدارة)
async function getAllCatalog(req, res, next) {
  try {
    const items = await RewardItem.find().sort({ pointsCost: 1 });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// POST /api/rewards (محمي: SETTINGS_MANAGER_ROLES)
async function createRewardItem(req, res, next) {
  try {
    const { title, description, pointsCost, tier, deliveryType } = req.body;
    if (!title || !pointsCost || !tier || !deliveryType) {
      return res.status(400).json({ message: 'اسم الهدية والنقاط المطلوبة والفئة وطريقة التسليم كلها مطلوبة.' });
    }

    const imageUrl = req.file ? req.file.path : null;

    const item = await RewardItem.create({
      title,
      description: description || '',
      pointsCost: Number(pointsCost),
      tier,
      deliveryType,
      imageUrl
    });

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: `تمت إضافة هدية جديدة لمتجر الهدايا: "${title}" (${pointsCost} ورق).`
    });

    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
}

// PUT /api/rewards/:id (محمي: SETTINGS_MANAGER_ROLES)
async function updateRewardItem(req, res, next) {
  try {
    const item = await RewardItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'الهدية غير موجودة.' });

    const { title, description, pointsCost, tier, deliveryType, active } = req.body;
    if (title !== undefined) item.title = title;
    if (description !== undefined) item.description = description;
    if (pointsCost !== undefined) item.pointsCost = Number(pointsCost);
    if (tier !== undefined) item.tier = tier;
    if (deliveryType !== undefined) item.deliveryType = deliveryType;
    if (active !== undefined) item.active = active === 'true' || active === true;

    if (req.file) {
      if (item.imageUrl) {
        await safeDeleteFromCloudinary(item.imageUrl, 'image');
      }
      item.imageUrl = req.file.path;
    }

    await item.save();
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/rewards/:id (محمي: SETTINGS_MANAGER_ROLES)
async function deleteRewardItem(req, res, next) {
  try {
    const item = await RewardItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'الهدية غير موجودة.' });

    if (item.imageUrl) {
      await safeDeleteFromCloudinary(item.imageUrl, 'image');
    }
    await item.deleteOne();

    res.json({ message: 'تم حذف الهدية من الكتالوج.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/rewards/:id/redeem (محمي: قارئ)
async function redeemReward(req, res, next) {
  try {
    const item = await RewardItem.findOne({ _id: req.params.id, active: true });
    if (!item) return res.status(404).json({ message: 'الهدية غير متاحة حاليًا.' });

    const reader = req.reader;
    const { shippingAddress } = req.body;

    if (item.deliveryType === 'shipping' && (!shippingAddress || !shippingAddress.trim())) {
      return res.status(400).json({ message: 'يرجى إدخال عنوان الشحن لهذه الهدية.' });
    }

    await deductPoints(reader, item.pointsCost, 'redeem_reward', `استبدال هدية: "${item.title}".`);

    let voucherCode = null;
    if (item.deliveryType === 'voucher') {
      voucherCode = `WRQ-${Date.now().toString(36).toUpperCase()}`;
    }

    const redemption = await RedemptionRequest.create({
      reader: reader._id,
      rewardItem: item._id,
      rewardTitleSnapshot: item.title,
      pointsSpent: item.pointsCost,
      status: item.deliveryType === 'auto' || item.deliveryType === 'voucher' ? 'fulfilled' : 'pending',
      voucherCode,
      shippingAddress: shippingAddress || ''
    });

    res.status(201).json({ redemption, waraqBalance: reader.waraqBalance });
  } catch (err) {
    next(err);
  }
}

// GET /api/rewards/my-redemptions (محمي: قارئ)
async function getMyRedemptions(req, res, next) {
  try {
    const redemptions = await RedemptionRequest.find({ reader: req.reader._id }).sort({ createdAt: -1 });
    res.json({ redemptions });
  } catch (err) {
    next(err);
  }
}

// GET /api/rewards/redemptions (محمي: SETTINGS_MANAGER_ROLES) - كل طلبات الاستبدال (لوحة الإدارة)
async function getAllRedemptions(req, res, next) {
  try {
    const redemptions = await RedemptionRequest.find()
      .populate('reader', 'name email')
      .sort({ createdAt: -1 })
      .limit(300);
    res.json({ redemptions });
  } catch (err) {
    next(err);
  }
}

// PUT /api/rewards/redemptions/:id (محمي: SETTINGS_MANAGER_ROLES) - تحديث حالة طلب استبدال
async function updateRedemptionStatus(req, res, next) {
  try {
    const redemption = await RedemptionRequest.findById(req.params.id);
    if (!redemption) return res.status(404).json({ message: 'طلب الاستبدال غير موجود.' });

    const { status, adminNote } = req.body;
    if (status) redemption.status = status;
    if (adminNote !== undefined) redemption.adminNote = adminNote;
    await redemption.save();

    res.json({ redemption });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getActiveCatalog,
  getAllCatalog,
  createRewardItem,
  updateRewardItem,
  deleteRewardItem,
  redeemReward,
  getMyRedemptions,
  getAllRedemptions,
  updateRedemptionStatus
};
