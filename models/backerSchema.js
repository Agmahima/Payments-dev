const mongoose = require('mongoose');

const backerSchema = new mongoose.Schema({
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
  backer_type: { type: String, required: true }, // Type of backer (e.g., 'Investor', 'Partner')
  backer_role: { type: String, required: true }, // Role of the backer (e.g., 'Lead Investor', 'Strategic Partner')
  backer: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'backer_type', // Dynamic reference based on backer_type (can reference User or Entity)
    required: true
  },
  backer_testimony: { type: String, required: true }, // Testimony from the backer
  backer_since: { type: Date, default: Date.now } // Date when the backer came on board
});

const Backer = mongoose.model('Backer', backerSchema);
module.exports = Backer;
