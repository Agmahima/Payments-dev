const mongoose = require('mongoose');

const paymentGatewaySchema = new mongoose.Schema({
    gateway_name: { type: String, required: true },
    description: { type: String },
    gatewayIdentifier: { type: String, required: true, unique: true },
    logoUrl: { type: String },
    isActive: { type: Boolean, default: true },
    supportedCurrencies: [{ type: String }],
    transactionFees: {
        flatFee: { type: Number },
        percentage: { type: Number }
    },
    config: {
        apiKey: { type: String, required: true },
        secretKey: { type: String, required: true },
        webHookUrl: { type: String }
    },
    createdTs: { type: Date, default: Date.now },
    updatedTs: { type: Date }
});

module.exports = mongoose.model('PaymentGateway', paymentGatewaySchema);
