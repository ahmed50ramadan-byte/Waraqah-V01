const mongoose = require('mongoose');

const redemptionRequestSchema = new mongoose.Schema(
  {
    reader: { type: mongoose.Schema.Types.ObjectId, ref: 'Reader', required: true },
    rewardItem: { type: mongoose.Schema.Types.ObjectId, ref: 'RewardItem', required: true },
    rewardTitleSnapshot: { type: String, required: true }, // نحفظ اسم الهدية وقت الاستبدال حتى لو اتعدلت لاحقًا
    pointsSpent: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'fulfilled', 'cancelled'],
      default: 'pending'
    },
    voucherCode: { type: String, default: null }, // لهدايا نوع voucher
    shippingAddress: { type: String, default: '' }, // لهدايا نوع shipping
    adminNote: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RedemptionRequest', redemptionRequestSchema);
