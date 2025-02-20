// models/rulesSchema.js
const mongoose = require("mongoose");
const { accessDbConnection } = require('../dbConnections');

const rulesSchema = new mongoose.Schema({
  workspaceType: { type: String, required: true }, // Workspace type (e.g., Startup, Enterprise)
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null }, // Null for default rules
  level: { type: Number, required: true }, // Role level (1 = Owner, 2 = Admin, 3 = Member, etc.)
  rules: [
    {
      page: { type: String, required: true }, // Page name
      features: [
        {
          text: { type: String },
          feature: { type: String, required: true }, // Feature name
          actions: [{ type: String, enum: ["view", "edit", "create", "delete"] }], // Allowed actions
        },
      ],
    },
  ],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = accessDbConnection.model("Rules", rulesSchema);
