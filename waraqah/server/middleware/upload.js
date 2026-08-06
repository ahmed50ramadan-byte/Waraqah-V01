const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../utils/cloudinary');

// التخزين بقى على Cloudinary مباشرة بدل القرص المحلي - ضروري لأن Vercel Serverless
// بيمسح أي ملف اتخزن على القرص بعد كل طلب (الـ filesystem مؤقت وغير دائم هناك).

const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'waraqah/images',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif']
  }
});

const audioStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'waraqah/audio',
    resource_type: 'video', // Cloudinary بيتعامل مع الملفات الصوتية تحت نوع "video"
    allowed_formats: ['mp3', 'wav', 'm4a', 'ogg']
  }
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('يُسمح برفع ملفات الصور فقط.'));
    }
    cb(null, true);
  }
});

const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('audio/')) {
      return cb(new Error('يُسمح برفع ملفات صوتية فقط.'));
    }
    cb(null, true);
  }
});

module.exports = { imageUpload, audioUpload };
