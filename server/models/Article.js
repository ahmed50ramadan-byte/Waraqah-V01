const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    from: { type: String, enum: ['reviewer', 'author'], required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    text: { type: String, required: true }
  },
  { timestamps: true }
);

const articleSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'عنوان المقال مطلوب'], trim: true },
    body: { type: String, default: '' },
    coverImage: { type: String, default: null },
    tags: {
      type: [String],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'يجب اختيار تصنيف أو وسم واحد على الأقل.'
      }
    },
    // public: مجاني للجميع | registered: لازم تسجيل قارئ مجاني | golden: عضوية ذهبية مدفوعة فقط
    accessLevel: { type: String, enum: ['public', 'registered', 'golden'], default: 'public' },
    audio: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'revision', 'published', 'blocked'],
      default: 'pending'
    },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, required: true },
    views: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Reader' }],
    commentsCount: { type: Number, default: 0 },
    // يتحكم في ظهور المقال المنشور للقراء من عدمه، بدون حذفه أو تغيير حالة المراجعة
    visible: { type: Boolean, default: true },
    ratings: {
      // كائن عادي بدل Map: {"readerId": 5, "readerId2": 3, ...}
      // أكثر ثباتًا من Map في التسلسل (serialization) وتتبّع التعديلات (markModified صريح)
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    chat: [chatMessageSchema],
    publishedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

articleSchema.methods.averageRating = function () {
  const values = Object.values(this.ratings || {});
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
};

module.exports = mongoose.model('Article', articleSchema);
