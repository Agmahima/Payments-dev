import mongoose, { Schema } from 'mongoose';
import { IPayment } from '../types/payment.types';
// const { baseDbConnection } = require('../dbConnections');
import { baseDbConnection } from '../dbConnections'; // ✅ Use ES6 import instead of require


const ServiceAllocationSchema = new Schema({
  serviceType: {
    type: String,
    enum: ['flight', 'hotel', 'cab', 'activity', 'fees', 'taxes'],
    required: true
  },
  serviceId: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  allocatedAmount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  }
}, { _id: false });

const PaymentSchema = new Schema<IPayment>({
  bookingId: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  paymentType: {
    type: String,
    enum: ['booking', 'partial', 'additional', 'refund'],
    default: 'booking'
  },
  serviceAllocation: [ServiceAllocationSchema],
  
  // Gateway Information
  razorpayOrderId: {
    type: String,
    sparse: true,
    index: true
  },
  razorpayPaymentId: {
    type: String,
    sparse: true
  },
  transactionRef: {
    type: String,
    required: false,
    index: true
    
  },
  paymentGateway: {
    type: String,
    required: true,
    enum: ['razorpay', 'stripe', 'cashfree'],
    index: true
  },
  
  // Payment Details
  paymentMethod: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet', 'other']
  },
  paymentMethodDetails: {
    // Card details (if applicable)
    card: {
      network: { type: String, enum: ['visa', 'mastercard', 'amex', 'rupay'] },
      type: { type: String, enum: ['credit', 'debit'] },
      last4: String,
      bank: String
    },
    // UPI details (if applicable)
    upi: {
      vpa: String,
      app: String
    },
    // Net banking details (if applicable)
    netbanking: {
      bankCode: String,
      bankName: String
    },
    // Wallet details (if applicable)
    wallet: {
      name: String,
      id: String
    }
  },
  
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  
  // Status Tracking
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // Timestamps
  initiatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: Date,
  
  // Gateway Response Storage
  gatewayResponse: {
    raw: Schema.Types.Mixed,
    receiptUrl: String,
    failureReason: String,
    errorCode: String
  },
  
  // Refund Information
  refundDetails: {
    refundId: String,
    refundAmount: Number,
    refundReason: String,
    refundDate: Date,
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'failed']
    }
  },
  
  // Metadata
  processedBy: String,
  notes: String,
  customerDetails: {
    name: String,
    email: String,
    phone: String
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
PaymentSchema.index({ bookingId: 1, status: 1 });
PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ paymentGateway: 1, status: 1 });
PaymentSchema.index({ razorpayOrderId: 1, razorpayPaymentId: 1 });

// Instance methods
PaymentSchema.methods.markAsPaid = function(paymentDetails: any) {
  this.status = 'paid';
  this.completedAt = new Date();
  this.razorpayPaymentId = paymentDetails.razorpay_payment_id || paymentDetails.id;
  this.gatewayResponse.raw = paymentDetails;
  return this.save();
};

PaymentSchema.methods.markAsFailed = function(reason: string, errorCode?: string) {
  this.status = 'failed';
  this.gatewayResponse.failureReason = reason;
  this.gatewayResponse.errorCode = errorCode;
  return this.save();
};

PaymentSchema.methods.initiateRefund = function(refundAmount: number, reason: string) {
  this.refundDetails = {
    refundAmount,
    refundReason: reason,
    refundDate: new Date(),
    refundStatus: 'pending'
  };
  if (refundAmount >= this.amount) {
    this.status = 'refunded';
  }
  return this.save();
};

export const Payment = baseDbConnection.model<IPayment>('Payment', PaymentSchema);