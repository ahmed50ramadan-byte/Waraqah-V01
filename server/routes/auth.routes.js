const express = require('express');
const router = express.Router();
const { protectStaff, requireRoles } = require('../middleware/auth');
const { STAFF_CREATOR_ROLES } = require('../utils/roles');
const {
  bootstrapFirstAdmin,
  loginStaff,
  createStaffAccount,
  getStaffProfile
} = require('../controllers/auth.controller');

router.post('/bootstrap', bootstrapFirstAdmin);
router.post('/login', loginStaff);
router.get('/me', protectStaff, getStaffProfile);
router.post('/staff', protectStaff, requireRoles(...STAFF_CREATOR_ROLES), createStaffAccount);

module.exports = router;
