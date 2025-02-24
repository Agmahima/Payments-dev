const mongoose = require('mongoose');
const { businessDbConnection } = require('../dbConnections');

const transactionSchema = new mongoose.Schema({
    transactionId: { type: String, unique: true, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
    paymentGatewayId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentGateway', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true }  ,
    paymentMethod: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['initiated', 'pending', 'processing', 'success', 'failed', 'cancelled'], 
        default: 'initiated' 
    },
    gatewayOrderId: { type: String },
    gatewayPaymentId: { type: String },
    gatewayRefundId: { type: String },
    metadata: { type: Object },
    errorReason: { type: String }
}, {
    timestamps: {
        createdAt: 'createdTs',
        updatedAt: 'updatedTs'
    }
});

module.exports = businessDbConnection.model('Transaction', transactionSchema);