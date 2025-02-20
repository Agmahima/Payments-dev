const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
    paymentFor: { type: mongoose.Schema.Types.ObjectId, required: true }, // Lookup ID
    paymentMethod: { type: mongoose.Schema.Types.ObjectId, required: true }, // Lookup ID
    paymentGateway: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentGateway', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },//transaction schema to be drfined 
    transactionId: { type: String, unique: true, ref: 'Transaction', required: true },
    paymentLink: { type: String },
    createdBy: { type: String, required: true },
    updatedBy: { type: String },
    createdTs: { type: Date, default: Date.now },
    updatedTs: { type: Date }
});

module.exports = mongoose.model('Payment', paymentSchema);
