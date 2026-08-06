const mongoose = require('mongoose');

const goldSubscriptionOrderSchema = new mongoose.Schema(
  {
    reader: { type: mongoose.Schema.Types.ObjectId, ref: 'Reader', required: true },
    merchantOrderId: { type: String, required: true, unique: true },
    paymobOrderId: { type: String, default: null },
    amountCents: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['card', 'wallet'], required: true },
    walletNumber: { type: String, default: null },
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    paymobTransactionId: { type: String, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('GoldSubscriptionOrder', goldSubscriptionOrderSchema);
