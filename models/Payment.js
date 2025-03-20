const mongoose = require('mongoose');
const { vaultDbConnection } = require('../dbConnections');

const PaymentSchema = new mongoose.Schema({
  request_ref: {
    type: String,
    required: true,
    unique: true
  },
  payment_purpose: {
    type: String,
    enum: ['Investment', 'Subscription', 'Service'],
    required: true
  },
  payment_amount: {
    type: Number,
    required: true
  },
  payment_currency: {
    type: String,
    default: 'INR'
  },
  payee_ref: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  payee_type: {
    type: String,
    required: true
  },
  receiver_ref: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  receiver_type: {
    type: String,
    required: true
  },
  payee_location: {
    type: String,
    default: 'IN'
  },
  payment_gateway: {
    type: String,
    enum: ['CASHFREE', 'RAZORPAY'],
    default: 'CASHFREE'
  },
  payment_status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
    default: 'PENDING'
  },
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }
}, { timestamps: true });

module.exports = vaultDbConnection.model('Payment', PaymentSchema);
