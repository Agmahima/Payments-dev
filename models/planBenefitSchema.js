const mongoose = require("mongoose");
const { accessDbConnection } = require("../dbConnections");

const tierLimitSchema = new mongoose.Schema({
  tier: { type: String, required: true }, // "Free", "Tier 1", "Tier 2", etc.
  limit: { type: mongoose.Schema.Types.Mixed, default: null }, // Limit as per tier (number, boolean, etc.)
});

const featureSchema = new mongoose.Schema({
  name: { type: String, required: true }, // E.g., "Total videos allowed in profile"
  description: { type: String, default: "" }, // Description of the feature
  limits: { type: [tierLimitSchema], default: [] }, // Limits for different tiers
});

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true }, // E.g., "Media", "Profile", "Finance"
  features: { type: [featureSchema], default: [] }, // List of features within the category
});

module.exports = { categorySchema, featureSchema, tierLimitSchema };
