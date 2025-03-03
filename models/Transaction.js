const mongoose = require('mongoose');
const { vaultDbConnection } = require('../dbConnections');

const TransactionSchema = new mongoose.Schema({
  transaction_mode: {
    type: String,
    enum: ['UPI', 'NET_BANKING', 'WALLET', 'CARD', 'OTHER'],
    default: 'OTHER'
  },
  payment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  gateway_used: {
    type: String,
    enum: ['CASHFREE', 'RAZORPAY'],
    required: true
  },
  gateway_response: {
    type: Object,
    default: {}
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

module.exports = vaultDbConnection.model('Transaction', TransactionSchema); 