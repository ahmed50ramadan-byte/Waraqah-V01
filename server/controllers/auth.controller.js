const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const generateToken = require('../utils/generateToken');
const { ROLES, ALL_ROLES } = require('../utils/roles');

async function pushAudit(role, username, note) {
  await AuditLog.create({ role, username, note });
}

// POST /api/auth/bootstrap
// يعمل مرة واحدة فقط: لو مفيش أي مستخدمين، بينشئ أول حساب "مالك" في النظام.
async function bootstrapFirstAdmin(req, res, next) {
  try {
    const existingCount = await User.countDocuments();
    if (existingCount > 0) {
      return res.status(400).json({ message: 'تم بالفعل إنشاء حسابات في النظام، لا يمكن تكرار هذا الإجراء.' });
    }

    const { username, password, email } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'اسم المستخدم وكلمة السر مطلوبان.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'كلمة السر يجب أن تكون 6 أحرف على الأقل.' });
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      username,
      email: email || '',
      passwordHash,
      role: ROLES.OWNER
    });

    await pushAudit(user.role, user.username, 'تم تفعيل الحساب الرئيسي للنظام (المالك).');

    const token = generateToken(user._id, 'staff');
    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function loginStaff(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'اسم المستخدم وكلمة السر مطلوبان.' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'اسم المستخدم أو كلمة السر غير صحيحة.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'اسم المستخدم أو كلمة السر غير صحيحة.' });
    }

    const token = generateToken(user._id, 'staff');
    res.json({ user, token });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/staff  (محمي: المالك / رئيس التحرير / مدير التحرير / IT فقط)
async function createStaffAccount(req, res, next) {
  try {
    const { username, password, email, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ message: 'اسم المستخدم وكلمة السر والدور الوظيفي مطلوبون.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'كلمة السر يجب أن تكون 6 أحرف على الأقل.' });
    }
    if (!ALL_ROLES.includes(role)) {
      return res.status(400).json({ message: 'الدور الوظيفي المحدد غير صالح.' });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ message: 'اسم المستخدم مأخوذ بالفعل، جرّب اسمًا آخر.' });
    }

    const passwordHash = await User.hashPassword(password);
    const newUser = await User.create({ username, email: email || '', passwordHash, role });

    await pushAudit(req.user.role, req.user.username, `تم إنشاء حساب موظف جديد [${username}] بدور [${role}].`);

    res.status(201).json({ user: newUser });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me  (محمي)
async function getStaffProfile(req, res, next) {
  try {
    res.json({ user: req.user });
  } catch (err) {
    next(err);
  }
}

module.exports = { bootstrapFirstAdmin, loginStaff, createStaffAccount, getStaffProfile };
