const express = require('express');
const router = express.Router();
const { protectStaff, protectReader, requireRoles } = require('../middleware/auth');
const { SETTINGS_MANAGER_ROLES } = require('../utils/roles');
const { imageUpload } = require('../middleware/upload');
const {
  getActiveCatalog,
  getAllCatalog,
  createRewardItem,
  updateRewardItem,
  deleteRewardItem,
  redeemReward,
  getMyRedemptions,
  getAllRedemptions,
  updateRedemptionStatus
} = require('../controllers/rewards.controller');

// ---------- عام ----------
router.get('/', getActiveCatalog);

// ---------- قارئ ----------
router.post('/:id/redeem', protectReader, redeemReward);
router.get('/my-redemptions', protectReader, getMyRedemptions);

// ---------- إدارة الكتالوج (SETTINGS_MANAGER_ROLES) ----------
router.get('/all', protectStaff, requireRoles(...SETTINGS_MANAGER_ROLES), getAllCatalog);
router.post('/', protectStaff, requireRoles(...SETTINGS_MANAGER_ROLES), imageUpload.single('image'), createRewardItem);
router.put('/:id', protectStaff, requireRoles(...SETTINGS_MANAGER_ROLES), imageUpload.single('image'), updateRewardItem);
router.delete('/:id', protectStaff, requireRoles(...SETTINGS_MANAGER_ROLES), deleteRewardItem);

// ---------- إدارة طلبات الاستبدال (SETTINGS_MANAGER_ROLES) ----------
router.get('/redemptions', protectStaff, requireRoles(...SETTINGS_MANAGER_ROLES), getAllRedemptions);
router.put('/redemptions/:id', protectStaff, requireRoles(...SETTINGS_MANAGER_ROLES), updateRedemptionStatus);

module.exports = router;
