const SiteSettings = require('../models/SiteSettings');
const AuditLog = require('../models/AuditLog');

// GET /api/settings (عام)
async function getSettings(req, res, next) {
  try {
    const settings = await SiteSettings.getSingleton();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

// POST /api/settings/social (محمي: SETTINGS_MANAGER_ROLES) - إضافة رابط سوشيال ميديا جديد (أي منصة براحتك)
async function addSocialLink(req, res, next) {
  try {
    const { label, url } = req.body;
    if (!label || !label.trim() || !url || !url.trim()) {
      return res.status(400).json({ message: 'اسم المنصة والرابط مطلوبان.' });
    }

    const settings = await SiteSettings.getSingleton();
    settings.socialLinks.push({ label: label.trim(), url: url.trim() });
    await settings.save();

    await AuditLog.create({
      role: req.user.role,
      username: req.user.username,
      note: `تمت إضافة رابط سوشيال ميديا جديد: ${label.trim()}.`
    });

    res.status(201).json({ settings });
  } catch (err) {
    next(err);
  }
}

// PUT /api/settings/social/:linkId (محمي: SETTINGS_MANAGER_ROLES)
async function updateSocialLink(req, res, next) {
  try {
    const settings = await SiteSettings.getSingleton();
    const link = settings.socialLinks.id(req.params.linkId);
    if (!link) return res.status(404).json({ message: 'الرابط غير موجود.' });

    const { label, url } = req.body;
    if (label !== undefined) link.label = label.trim();
    if (url !== undefined) link.url = url.trim();

    await settings.save();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/settings/social/:linkId (محمي: SETTINGS_MANAGER_ROLES)
async function deleteSocialLink(req, res, next) {
  try {
    const settings = await SiteSettings.getSingleton();
    const link = settings.socialLinks.id(req.params.linkId);
    if (!link) return res.status(404).json({ message: 'الرابط غير موجود.' });

    link.deleteOne();
    await settings.save();

    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSettings, addSocialLink, updateSocialLink, deleteSocialLink };
