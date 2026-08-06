const express = require('express');
const router = express.Router();
const { protectStaff, optionalReader, requireRoles } = require('../middleware/auth');
const { SETTINGS_MANAGER_ROLES } = require('../utils/roles');
const { imageUpload } = require('../middleware/upload');
const { getActiveAds, getAllAds, createAd, updateAd, deleteAd, recordAdClick } = require('../controllers/ads.controller');

// ---------- عام ----------
router.get('/', getActiveAds);
router.post('/:id/click', optionalReader, recordAdClick);

// ---------- إدارة الإعلانات (SETTINGS_MANAGER_ROLES) ----------
router.get('/all', protectStaff, requireRoles(...SETTINGS_MANAGER_ROLES), getAllAds);
router.post('/', protectStaff, requireRoles(...SETTINGS_MANAGER_ROLES), imageUpload.single('image'), createAd);
router.put('/:id', protectStaff, requireRoles(...SETTINGS_MANAGER_ROLES), imageUpload.single('image'), updateAd);
router.delete('/:id', protectStaff, requireRoles(...SETTINGS_MANAGER_ROLES), deleteAd);

module.exports = router;
