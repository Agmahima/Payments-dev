const mongoose = require('mongoose');

const debtSchema = new mongoose.Schema({
  round: { type: mongoose.Schema.Types.ObjectId, ref: 'Round', required: true }, // Reference to the funding round
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true }, // Reference to the entity taking on the debt
  amount: { type: Number, required: true }, // The amount of debt taken
  instrument: { type: String, required: true }, // The type of financial instrument (e.g., Loan, Bond)
  unit: { type: Number, required: true }, // The number of units or parts of the debt (e.g., number of bonds)
  transfer_date: { type: Date, required: true }, // Date when the debt transaction took place
  debt_period: { type: Number, required: true }, // Duration of the debt repayment period (in months or years)
  interest: { type: Number, required: true }, // Interest rate on the debt (as a percentage)
  debtor: { type: mongoose.Schema.Types.ObjectId, refPath: 'debtorType', required: true }, // Reference to the debtor (either User or Entity)
  debtorType: { type: String, enum: ['User', 'Entity'], required: true }, // Type of debtor (User or Entity)
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }, // Reference to the transaction related to the debt
  documents: [{
    type: { type: String, required: true }, // Type of the document (e.g., 'Contract', 'Agreement')
    doc_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true }, // Reference to the document
  }],
  added_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // User who added the debt record
  added_on: { type: Date, default: Date.now }, // Timestamp when the debt record was created
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt fields
});

const Debt = mongoose.model('Debt', debtSchema);
module.exports = Debt;
