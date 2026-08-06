// =============================================================
// تعريف الأدوار الوظيفية وصلاحياتها - مصدر واحد للحقيقة (Single Source of Truth)
// =============================================================

const ROLES = {
  OWNER: 'المالك (Owner)',
  EDITOR_IN_CHIEF: 'رئيس التحرير (Editor-in-Chief)',
  DEPUTY_EDITOR: 'نائب رئيس التحرير (Deputy Editor)',
  MANAGING_EDITOR: 'مدير التحرير (Managing Editor)',
  EDITORIAL_COORDINATOR: 'منسق التحرير (Editorial Coordinator)',
  SECTION_EDITOR: 'محرر القسم (Section Editor)',
  CONTENT_WRITER: 'كاتب المحتوى (Content Writer)',
  TRANSLATOR: 'المترجم الأدبي (Translator)',
  PROOFREADER: 'المدقق اللغوي (Proofreader)',
  GRAPHIC_DESIGNER: 'مصمم الجرافيك (Graphic Designer)',
  DIGITAL_CONTENT_MANAGER: 'مدير المحتوى الرقمي (Digital Content Manager)',
  IT: 'قسم تكنولوجيا المعلومات (IT)'
};

const ALL_ROLES = Object.values(ROLES);

// جهات المراجعة: تملك صلاحية نشر / إعادة مراجعة / حظر المقالات
const REVIEWER_ROLES = [
  ROLES.OWNER,
  ROLES.EDITOR_IN_CHIEF,
  ROLES.DEPUTY_EDITOR,
  ROLES.MANAGING_EDITOR,
  ROLES.EDITORIAL_COORDINATOR,
  ROLES.SECTION_EDITOR
];

// مين يقدر يكتب ويقدّم مقال
const WRITER_ROLES = [
  ...REVIEWER_ROLES,
  ROLES.CONTENT_WRITER,
  ROLES.TRANSLATOR
];

// إدارة فريق التحرير (إضافة/تعديل/حذف الأعضاء المعروضين بالموقع)
const TEAM_MANAGER_ROLES = [ROLES.OWNER, ROLES.EDITOR_IN_CHIEF];

// إنشاء حسابات الموظفين الجدد
const STAFF_CREATOR_ROLES = [
  ROLES.OWNER,
  ROLES.EDITOR_IN_CHIEF,
  ROLES.MANAGING_EDITOR,
  ROLES.IT
];

// إدارة إعدادات الموقع العامة (روابط السوشيال ميديا + الإعلانات)
const SETTINGS_MANAGER_ROLES = [ROLES.OWNER, ROLES.EDITOR_IN_CHIEF, ROLES.IT];

module.exports = {
  ROLES,
  ALL_ROLES,
  REVIEWER_ROLES,
  WRITER_ROLES,
  TEAM_MANAGER_ROLES,
  STAFF_CREATOR_ROLES,
  SETTINGS_MANAGER_ROLES
};
