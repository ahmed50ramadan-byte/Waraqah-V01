const express = require('express');
const router = express.Router();
const { protectStaff, requireRoles } = require('../middleware/auth');
const { SETTINGS_MANAGER_ROLES } = require('../utils/roles');
const { getSettings, addSocialLink, updateSocialLink, deleteSocialLink } = require('../controllers/settings.controller');

router.get('/', getSettings); // عام - كل زائر يشوف روابط السوشيال ميديا

router.post('/social', protectStaff, requireRoles(...SETTINGS_MANAGER_ROLES), addSocialLink);
router.put('/social/:linkId', protectStaff, requireRoles(...SETTINGS_MANAGER_ROLES), updateSocialLink);
router.delete('/social/:linkId', protectStaff, requireRoles(...SETTINGS_MANAGER_ROLES), deleteSocialLink);

module.exports = router;
