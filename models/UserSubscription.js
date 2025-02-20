// const mongoose = require('mongoose');

// const userSubscriptionSchema = new mongoose.Schema({
//     subscription_id: { type: String, required: true, unique: true },
//     payment_method_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
//     autoRenewal: { type: Boolean, default: true },
//     status: { type: String, enum: ['active', 'inactive', 'cancelled'], default: 'active' },
//     renewal_ts: { type: Date },
//     amount: { type: Number, required: true },
//     currency: { type: String, required: true },
//     createdTs: { type: Date, default: Date.now },
//     updatedTs: { type: Date },
//     createdBy: { type: String, required: true },
//     updatedBy: { type: String }
// });

// module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
const mongoose = require("mongoose");
//const { accessDbConnection } = require("../dbConnections");

const usedBenefitSchema = new mongoose.Schema({
    category: { type: String, required: true },
    feature: { type: String, required: true },
    limit: { type: Number, required: true },
    usage: { type: Number, default: 0 },
});

const userSubscriptionSchema = new mongoose.Schema(
    {
        person_id: { type: mongoose.Schema.Types.ObjectId, ref: "Person", default: null },
        workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },
        current_tier: { type: String, default: "free" },
        valid_until: { type: Date, required: true },
        payment_transaction_id: { type: String, default: "" },
        used_benefits: { type: [usedBenefitSchema], default: [] },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    });

module.exports = mongoose.model("UserSubscription", userSubscriptionSchema);