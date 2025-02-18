const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
    subscription_id: { type: String, required: true, unique: true },
    payment_method_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    autoRenewal: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'inactive', 'cancelled'], default: 'active' },
    renewal_ts: { type: Date },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    createdTs: { type: Date, default: Date.now },
    updatedTs: { type: Date },
    createdBy: { type: String, required: true },
    updatedBy: { type: String }
});

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
