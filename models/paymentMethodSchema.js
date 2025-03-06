const mongoose = require('mongoose');
const { vaultDbConnection } = require('../dbConnections');

const PaymentMethodSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    method_type: { type: String, enum: ['CARD', 'UPI', 'NET_BANKING'], required: true },
    card_token: { type: String, required: true, unique: true },
    card_network: { type: String, required: true },
    card_type: { type: String, required: true },
    card_last4: { type: String, required: true, length: 4 },
    card_expiry: { type: String, required: true },
    is_default: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = vaultDbConnection.model('PaymentMethod', PaymentMethodSchema);
