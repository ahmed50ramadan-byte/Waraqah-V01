const Reader = require('../models/Reader');
const AuditLog = require('../models/AuditLog');

// GET /api/readers/admin/list (محمي: SETTINGS_MANAGER_ROLES) - بحث/عرض القرّاء لإدارة العضوية الذهبية
async function listReadersAdmin(req, res, next) {
  try {
    const { search } = req.query;
    const query = search
      ? { $or: [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] }
      : {};

    const readers = await Reader.find(query).select('name email isGoldMember waraqBalance waraqTotalEarned').sort({ createdAt: -1 }).limit(50);
    res.json({ readers });
  } catch (err) {
    next(err);
  }
}

// POST /api/readers/admin/:id/toggle-gold (محمي: SETTINGS_MANAGER_ROLES)
// ملاحظة مهمة: ده منح يدوي مؤقت لحد ما يتم ربط بوابة دفع فعلية (Stripe/Paymob/Fawry...) تفعّل العضوية تلقائيًا بعد الدفع.
async function toggleGoldMembership(req, res, next) {
  try {
    const reader = await Reader.findById(req.params.id);
    if (!reader) return res.status(404).json({ message: 'القارئ غير موجود.' });

    reader.isGoldMember = !reader.isGoldMember;
    reader.goldMembershipGrantedAt = reader.isGoldMember ? new Date() : null;
    await reader.save();

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: `تم ${reader.isGoldMember ? 'منح' : 'سحب'} العضوية الذهبية للقارئ [${reader.name}] (${reader.email}) يدويًا.`
    });

    res.json({ reader });
  } catch (err) {
    next(err);
  }
}

module.exports = { listReadersAdmin, toggleGoldMembership };
