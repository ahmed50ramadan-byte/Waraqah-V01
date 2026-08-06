const express = require('express');
const router = express.Router();
const { protectStaff } = require('../middleware/auth');
const { getAuditLogs, addAuditNote } = require('../controllers/audit.controller');

router.get('/', protectStaff, getAuditLogs);
router.post('/', protectStaff, addAuditNote);

module.exports = router;
