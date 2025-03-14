const mongoose = require('mongoose');
const { vaultDbConnection } = require('../dbConnections');

const TransactionSchema = new mongoose.Schema({
  transaction_mode: {
    type: String,
    enum: ['UPI', 'NET_BANKING', 'WALLET', 'CARD', 'OTHER'],
    default: 'OTHER',
    index: true 
  },
  transaction_status: {
    type: String,
    enum: ['INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'],
    default: 'INITIATED',
    index: true
  },
  transaction_id: {
    type: String, 
    sparse: true,
    index: true
  },
  payment_method_details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  payment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true,
    index: true
  },
  gateway_used: {
    type: String,
    enum: ['CASHFREE', 'RAZORPAY', 'PAYTM', 'STRIPE', 'INSTAMOJO', 'PAYU', 'OTHER'],
    required: true,
    index: true
  },
  gateway_response: {
    type: Object,
    default: {}
  },
  //gateway_order_id: String,  // Store gateway-specific order ID
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  error_message: String,
  error_code: String,
  refund_details: {
    refund_id: String,
    refund_amount: Number,
    refund_status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED'],
    },
    refund_time: Date
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }
}, { 
  timestamps: true,
  indexes: [
    { payment_id: 1, transaction_status: 1 },
    { created_at: -1, transaction_status: 1 },
    { gateway_used: 1, transaction_id: 1 },
    { gateway_order_id: 1 }
  ]
});

// Helper methods for transaction processing
TransactionSchema.methods.markAsSuccess = async function(gatewayResponse) {
  this.transaction_status = 'SUCCESS';
  this.transaction_id = 
    gatewayResponse.cf_payment_id || 
    gatewayResponse.razorpay_payment_id ||
    gatewayResponse.stripe_payment_id;
  this.gateway_response = gatewayResponse;
  this.updated_by = this.created_by; //  system update
  return this.save();
};

TransactionSchema.methods.markAsFailed = async function(error) {
  this.transaction_status = 'FAILED';
  this.error_message = error.message || error.description;
  this.error_code = error.code || error.status;
  this.updated_by = this.created_by; //  system update
  return this.save();
};

TransactionSchema.methods.markAsRefunded = async function(refundDetails) {
  this.transaction_status = 'REFUNDED';
  this.refund_details = {
    refund_id: refundDetails.refund_id,
    refund_amount: refundDetails.amount,
    refund_status: refundDetails.status,
    refund_time: new Date()
  };
  this.updated_by = this.created_by; //  system update
  return this.save();
};

// Static method to find transactions by gateway order ID
TransactionSchema.statics.findByGatewayOrderId = function(gatewayOrderId) {
  return this.findOne({ gateway_order_id: gatewayOrderId });
};

module.exports = vaultDbConnection.model('Transaction', TransactionSchema);