const mongoose = require('mongoose');

const pointsTransactionSchema = new mongoose.Schema(
  {
    reader: { type: mongoose.Schema.Types.ObjectId, ref: 'Reader', required: true, index: true },
    amount: { type: Number, required: true }, // موجب (كسب) أو سالب (صرف)
    type: {
      type: String,
      required: true,
      enum: [
        'welcome_bonus',
        'daily_login',
        'read_streak',
        'read_article',
        'active_time',
        'like_article',
        'write_comment',
        'share_article',
        'referral',
        'ad_click',
        'redeem_reward',
        'admin_adjustment'
      ]
    },
    description: { type: String, default: '' },
    relatedArticle: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PointsTransaction', pointsTransactionSchema);
