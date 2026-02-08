const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  type: {
    type: String,
    required: true,
    enum: ['card', 'upi', 'netbanking', 'wallet']
  },
  gateway: {
    type: String,
    required: true,
    enum: ['razorpay', 'cashfree']
  },
  // Card details
  card_token: {
    type: String
  },
  card_network: {
    type: String,
    enum: ['visa', 'mastercard', 'amex', 'rupay']
  },
  card_type: {
    type: String,
    enum: ['credit', 'debit']
  },
  card_last4: {
    type: String,
    length: 4
  },
  card_expiry: {
    type: String
  },
  // UPI details
  upi_id: {
    type: String
  },
  upi_app: {
    type: String,
    enum: ['gpay', 'phonepe', 'paytm', 'bhim']
  },
  // Net banking details
  bank_code: {
    type: String
  },
  bank_name: {
    type: String
  },
  // Wallet details
  wallet_name: {
    type: String,
    enum: ['paytm', 'mobikwik', 'freecharge']
  },
  wallet_id: {
    type: String
  },
  is_default: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Update the updated_at timestamp before saving
paymentMethodSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

const PaymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);

module.exports = PaymentMethod; 