const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    role: { type: String, required: true },
    username: { type: String, default: '' },
    note: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
