const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * يستخرج الـ public_id من رابط Cloudinary كامل، عشان نقدر نحذف الملف من هناك.
 * مثال رابط: https://res.cloudinary.com/demo/image/upload/v1690000000/waraqah/images/abc123.jpg
 * الناتج: waraqah/images/abc123
 */
function extractPublicIdFromUrl(url) {
  if (!url || !url.includes('res.cloudinary.com')) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
  return match ? match[1] : null;
}

/**
 * يحذف ملف من Cloudinary بأمان - بيتجاهل أي خطأ (زي إن الملف مش موجود أصلاً)
 * عشان عملية الحذف الأساسية (المقال/العضو/الإعلان) متفشلش بسبب مشكلة تنظيف بسيطة.
 */
async function safeDeleteFromCloudinary(url, resourceType = 'image') {
  const publicId = extractPublicIdFromUrl(url);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.warn('تعذّر حذف الملف من Cloudinary:', err.message);
  }
}

module.exports = { cloudinary, extractPublicIdFromUrl, safeDeleteFromCloudinary };
