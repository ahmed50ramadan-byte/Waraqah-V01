const express = require('express');
const router = express.Router();
const { protectReader, protectStaff, requireRoles } = require('../middleware/auth');
const { SETTINGS_MANAGER_ROLES } = require('../utils/roles');
const { registerReader, loginReader, getReaderProfile } = require('../controllers/reader.controller');
const { updateAccount } = require('../controllers/reader_account.controller');
const { listReadersAdmin, toggleGoldMembership } = require('../controllers/reader_admin.controller');
const { requestPasswordReset, confirmPasswordReset } = require('../controllers/password_reset.controller');

router.post('/register', registerReader);
router.post('/login', loginReader);
router.get('/me', protectReader, getReaderProfile);
router.put('/account', protectReader, updateAccount);

// ---------- استعادة كلمة السر عبر البريد الإلكتروني ----------
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', confirmPasswordReset);

// ---------- إدارة القرّاء (المالك/رئيس التحرير/IT) - للعضوية الذهبية ----------
router.get('/admin/list', protectStaff, requireRoles(...SETTINGS_MANAGER_ROLES), listReadersAdmin);
router.post('/admin/:id/toggle-gold', protectStaff, requireRoles(...SETTINGS_MANAGER_ROLES), toggleGoldMembership);

module.exports = router;
