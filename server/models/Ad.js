const mongoose = require('mongoose');

const adSchema = new mongoose.Schema(
  {
    // الثلاثة اختياريين تمامًا - على الأقل واحد منهم لازم يكون موجود (يتحقق منه في الكنترولر)
    imageUrl: { type: String, default: null },
    text: { type: String, default: '', trim: true },
    linkUrl: { type: String, default: '' },
    clicksCount: { type: Number, default: 0 },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ad', adSchema);
