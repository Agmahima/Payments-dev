const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
  round_name: { type: String, required: true }, // Name of the round (e.g., 'Seed Round', 'Series A')
  start_date: { type: Date, required: true }, // Start date of the funding round
  end_date: { type: Date, required: true }, // End date of the funding round
  round_target: { type: Number, required: true }, // Target amount to be raised in this round
  mode: { type: [String], enum: ['Equity', 'Debt', 'Grant'], required: true }, // Modes of funding in this round
  valuation: { type: mongoose.Schema.Types.ObjectId, ref: 'Valuation', required: true }, // Reference to the associated valuation
  investment: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Investment' }], // Array of investments in this round
  debt: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Debt' }], // Array of debts in this round
  grant: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Grant' }], // Array of grants in this round
  campaigns: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }], // Array of campaigns related to this round
  documents: [{ 
    type: String, // Type of document (e.g., 'Agreement', 'Pitch Deck')
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' } // Reference to the document
  }],
  dataroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataroom' }, // Reference to the dataroom for this round
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true }, // Reference to the creator of the round
  created_at: { type: Date, default: Date.now }, // Timestamp when the round was created
  updated_at: { type: Date, default: Date.now }, // Timestamp for the last update to the round
});

const Round = mongoose.model('Round', roundSchema);
module.exports = Round;
