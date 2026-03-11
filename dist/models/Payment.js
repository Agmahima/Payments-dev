"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Payment = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// const { baseDbConnection } = require('../dbConnections');
const dbConnections_1 = require("../dbConnections"); // ✅ Use ES6 import instead of require
const ServiceAllocationSchema = new mongoose_1.Schema({
    serviceType: {
        type: String,
        enum: ['flight', 'hotel', 'cab', 'activity', 'fees', 'taxes'],
        required: true
    },
    serviceId: {
        type: mongoose_1.default.Schema.Types.Mixed,
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
const PaymentSchema = new mongoose_1.Schema({
    bookingId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
        index: true
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
        raw: mongoose_1.Schema.Types.Mixed,
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
PaymentSchema.methods.markAsPaid = function (paymentDetails) {
    this.status = 'paid';
    this.completedAt = new Date();
    this.razorpayPaymentId = paymentDetails.razorpay_payment_id || paymentDetails.id;
    this.gatewayResponse.raw = paymentDetails;
    return this.save();
};
PaymentSchema.methods.markAsFailed = function (reason, errorCode) {
    this.status = 'failed';
    this.gatewayResponse.failureReason = reason;
    this.gatewayResponse.errorCode = errorCode;
    return this.save();
};
PaymentSchema.methods.initiateRefund = function (refundAmount, reason) {
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
exports.Payment = dbConnections_1.baseDbConnection.model('Payment', PaymentSchema);
