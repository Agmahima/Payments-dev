const mongoose = require("mongoose");
const { accessDbConnection } = require("../dbConnections");

const featureDetailSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  limit: { type: mongoose.Schema.Types.Mixed, default: null }, // e.g., 5 users, "unlimited"
});

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  features: { type: [featureDetailSchema], default: [] },
});

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    workspace_type: { type: String, required: true }, // E.g., "Startup", "LLC", "individual"
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    duration: { type: String, enum: ["monthly", "yearly", "quarterly"], required: true },
    free_trial_days: { type: Number, default: 0 }, // Free trial option
    discount: { type: Number, default: 0 }, // Discount option
    categories: { type: [categorySchema], default: [] },
  },
  {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

module.exports = accessDbConnection.model("SubscriptionPlan", subscriptionPlanSchema);
