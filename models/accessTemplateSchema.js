// models/accessTemplateModel.js
const mongoose = require("mongoose");
const { businessDbConnection } = require('../dbConnections');

const accessTemplateSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: false }, // Associated workspace
  roles: [
    {
      level: { type: Number, required: true }, // Role level (e.g., 1 = Owner, 2 = Admin, 3 = Member)
      name: { type: String, required: true }, // Role name (e.g., "Owner")
      rules: [
        {
          page: { type: String, required: true }, // Page name (e.g., "Settings")
          features: [
            {
              feature: { type: String, required: true }, // Feature name (e.g., "Workspace Settings")
              actions: [{ type: String, enum: ["view", "edit", "create", "delete"] }] // Allowed actions
            }
          ]
        }
      ]
    }
  ],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = businessDbConnection.model("AccessTemplate", accessTemplateSchema);
