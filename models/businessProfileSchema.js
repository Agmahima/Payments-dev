const mongoose = require('mongoose');
const { businessDbConnection } = require('../dbConnections');

const businessProfileSchema = new mongoose.Schema({
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
  brand_name: { type: String, required: true },
  website: { type: String },
  headline: { type: String },
  tags: [{ type: String }],
  logo: { type: String },
  about: { type: String },
  vision: { type: String },
  value_proposition: { type: String },
  usp: { type: String },
  created_on: { type: Date, default: Date.now },
  updated_on: { type: Date, default: Date.now },
});

module.exports = businessDbConnection.model('BusinessProfile', businessProfileSchema);
