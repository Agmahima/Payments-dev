const mongoose = require('mongoose');
const { accessDbConnection } = require('../dbConnections');

// Predefined valid actions 
const PREDEFINED_ACTIONS = ["view", "edit", "delete", "create", "archive"];

const featureSchema = new mongoose.Schema({
  feature: { type: String, required: true }, 
  description: { type: String, required: false }, 
  actions: [{ type: String, required: true }]
});

const pageSchema = new mongoose.Schema({
  pageName: { type: String, required: true },
  features: [featureSchema], 
});

const roleSchema = new mongoose.Schema({
  level: { type: Number, required: true },
  rules: [pageSchema],
});

const defaultRulesSchema = new mongoose.Schema({
  workspace_type: { type: String, required: true },
  roles: [roleSchema],
  
}, { timestamps: true });

module.exports = accessDbConnection.model('DefaultRules', defaultRulesSchema);
