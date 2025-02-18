const mongoose = require('mongoose');

const paymentLogSchema = new mongoose.Schema({
    paymentGatewayId: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentGateway', required: true },
    eventType: { type: String, enum: ['success', 'failed', 'pending'], required: true },
    payload: { type: Object, required: true },
    createdTs: { type: Date, default: Date.now },
    createdBy: { type: String, required: true },
    error: { type: String }
});

module.exports = mongoose.model('PaymentLog', paymentLogSchema);
