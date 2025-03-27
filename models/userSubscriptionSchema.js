const mongoose = require("mongoose");
const { accessDbConnection } = require("../dbConnections");

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
    subscription_id:{type:String,required:true},
    payment_transaction_id: { type: String, default: "" },
    used_benefits: { type: [usedBenefitSchema], default: [] },
  },
  {timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
}
});

module.exports = accessDbConnection.model("UserSubscription", userSubscriptionSchema);
