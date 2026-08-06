const TeamMember = require('../models/TeamMember');
const AuditLog = require('../models/AuditLog');
const { ROLES } = require('../utils/roles');
const { safeDeleteFromCloudinary } = require('../utils/cloudinary');

const ROLE_ORDER = {
  [ROLES.OWNER]: 1,
  [ROLES.EDITOR_IN_CHIEF]: 2,
  [ROLES.DEPUTY_EDITOR]: 3,
  [ROLES.MANAGING_EDITOR]: 4,
  [ROLES.EDITORIAL_COORDINATOR]: 5,
  [ROLES.SECTION_EDITOR]: 6,
  [ROLES.CONTENT_WRITER]: 7,
  [ROLES.TRANSLATOR]: 8,
  [ROLES.PROOFREADER]: 9,
  [ROLES.GRAPHIC_DESIGNER]: 10,
  [ROLES.DIGITAL_CONTENT_MANAGER]: 11,
  [ROLES.IT]: 12
};

// GET /api/team (عام - متاح للجميع، بيرجع الاسم والصورة والنبذة دايمًا)
async function getTeamMembers(req, res, next) {
  try {
    const members = await TeamMember.find().lean();
    members.sort((a, b) => (ROLE_ORDER[a.role] || 99) - (ROLE_ORDER[b.role] || 99));
    res.json({ members });
  } catch (err) {
    next(err);
  }
}

// POST /api/team (محمي: المالك / رئيس التحرير فقط)
async function createTeamMember(req, res, next) {
  try {
    const { name, role, bio } = req.body;
    if (!name || !role) {
      return res.status(400).json({ message: 'اسم العضو ودوره الوظيفي مطلوبان.' });
    }

    // req.file.path بيرجع رابط Cloudinary الكامل (multer-storage-cloudinary)
    const photo = req.file ? req.file.path : null;

    const member = await TeamMember.create({ name, role, bio: bio || '', photo });

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: `تمت إضافة عضو جديد للفريق [${name}] بدور [${role}].`
    });

    res.status(201).json({ member });
  } catch (err) {
    next(err);
  }
}

// PUT /api/team/:id (محمي: المالك / رئيس التحرير فقط)
async function updateTeamMember(req, res, next) {
  try {
    const member = await TeamMember.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'العضو غير موجود.' });

    const { name, role, bio } = req.body;
    if (name) member.name = name;
    if (role) member.role = role;
    if (bio !== undefined) member.bio = bio;

    if (req.file) {
      // احذف الصورة القديمة من Cloudinary لو موجودة
      if (member.photo) {
        await safeDeleteFromCloudinary(member.photo, 'image');
      }
      member.photo = req.file.path;
    }

    await member.save();

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: `تم تحديث بيانات العضو [${member.name}].`
    });

    res.json({ member });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/team/:id (محمي: المالك / رئيس التحرير فقط)
async function deleteTeamMember(req, res, next) {
  try {
    const member = await TeamMember.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'العضو غير موجود.' });

    if (member.photo) {
      await safeDeleteFromCloudinary(member.photo, 'image');
    }

    await member.deleteOne();

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: `تم حذف العضو [${member.name}] من الفريق.`
    });

    res.json({ message: 'تم حذف العضو بنجاح.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember };
