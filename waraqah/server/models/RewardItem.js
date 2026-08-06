const mongoose = require('mongoose');

const rewardItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    imageUrl: { type: String, default: null },
    pointsCost: { type: Number, required: true, min: 0 },
    tier: {
      type: String,
      enum: ['low', 'mid', 'high', 'vip'],
      required: true
    },
    deliveryType: {
      type: String,
      enum: ['auto', 'voucher', 'shipping', 'invitation'],
      required: true
    },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RewardItem', rewardItemSchema);
