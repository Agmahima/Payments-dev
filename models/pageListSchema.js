const mongoose = require('mongoose');
const { accessDbConnection } = require('../dbConnections');

const PageSchema = new mongoose.Schema({
  pageName: { type: String, required: true },
  features: { type: [String], default: [] },
});

const PageListSchema = new mongoose.Schema({
  workspace_type: { type: String, required: true },
  page: { type: [PageSchema], default: [] },
}, { timestamps: true });

module.exports = accessDbConnection.model('PageList', PageListSchema);
