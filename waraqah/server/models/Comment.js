const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true, index: true },
    reader: { type: mongoose.Schema.Types.ObjectId, ref: 'Reader', required: true },
    readerName: { type: String, required: true },
    text: { type: String, required: true, trim: true },
    pinned: { type: Boolean, default: false } // مزية رتبة "الناقد المشارك" فأعلى
  },
  { timestamps: true }
);

module.exports = mongoose.model('Comment', commentSchema);
