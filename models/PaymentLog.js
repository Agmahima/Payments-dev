const mongoose = require('mongoose');
const { businessDbConnection } = require('../dbConnections');

const paymentLogSchema = new mongoose.Schema({
    paymentGatewayId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'PaymentGateway', 
        required: true 
    },
    transactionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Transaction', 
        required: true 
    },
    eventType: { 
        type: String, 
        enum: ['initiated', 'success', 'failed', 'pending', 'cancelled'], 
        required: true 
    },
    payload: { type: Object, required: true },
    response: { type: Object },
    error: { type: String },
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Person', 
        required: true 
    }
}, {
    timestamps: {
        createdAt: 'createdTs',
        updatedAt: 'updatedTs'
    }
});

module.exports = businessDbConnection.model('PaymentLog', paymentLogSchema);
