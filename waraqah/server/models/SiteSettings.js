const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema(
  {
    // معرّف ثابت يضمن وجود مستند واحد بس دايمًا (Singleton)
    singleton: { type: String, default: 'main', unique: true },

    // مصفوفة مفتوحة: تقدر تضيف أي عدد ومنصات (فيسبوك، تيك توك، يوتيوب، واتساب، موقعك الشخصي...)
    socialLinks: [
      {
        label: { type: String, required: true, trim: true }, // اسم المنصة يكتبه الأدمن بحرّيته
        url: { type: String, required: true, trim: true }
      }
    ]
  },
  { timestamps: true }
);

// يرجع الإعدادات الوحيدة الموجودة، أو ينشئها لو أول مرة
siteSettingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne({ singleton: 'main' });
  if (!settings) {
    settings = await this.create({ singleton: 'main' });
  }
  return settings;
};

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
