const mongoose = require('mongoose');
const { businessDbConnection } = require('../dbConnections');

const investmentSchema = new mongoose.Schema({
  round: { type: mongoose.Schema.Types.ObjectId, ref: 'Round', required: true }, // Reference to the funding round
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true }, // Reference to the entity making the investment
  amount: { type: Number, required: true }, // The amount invested
  instrument: { type: String, required: true }, // The type of instrument (e.g., Equity, Debt, Convertible Note)
  units: { type: Number, required: true }, // Number of units purchased (e.g., number of shares)
  transfer_date: { type: Date, required: true }, // Date when the investment transaction took place
  investor: { type: mongoose.Schema.Types.ObjectId, refPath: 'investorType', required: true }, // Reference to the investor (either User or Entity)
  investorType: { type: String, enum: ['Person', 'Entity'], required: true }, // Type of investor (Person or Entity)
  transaction: { type: mongoose.Schema.Types.ObjectId }, // Reference to the transaction related to the investment
  documents: [{
    type: { type: String, required: true }, // Type of the document (e.g., 'Contract', 'Agreement')
    doc_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true }, // Reference to the document
  }],
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt fields
});

module.exports = businessDbConnection.model('Investment', investmentSchema);
