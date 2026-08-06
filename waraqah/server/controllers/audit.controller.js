const AuditLog = require('../models/AuditLog');

// GET /api/audit (محمي: أي موظف مسجل دخول)
async function getAuditLogs(req, res, next) {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(200);
    res.json({ logs });
  } catch (err) {
    next(err);
  }
}

// POST /api/audit (محمي: أي موظف مسجل دخول)
async function addAuditNote(req, res, next) {
  try {
    const { note } = req.body;
    if (!note || !note.trim()) {
      return res.status(400).json({ message: 'يرجى كتابة نص الملاحظة.' });
    }

    const log = await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: note.trim()
    });

    res.status(201).json({ log });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAuditLogs, addAuditNote };
