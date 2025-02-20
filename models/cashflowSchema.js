const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  flowDir: { type: String, enum: ['in', 'out'], required: true }, // 'in' for inflow, 'out' for outflow
  amount: { type: Number, required: true }, // Amount of the transaction
  date: { type: Date, required: true }, // Date of the transaction
  description: { type: String, required: true } // Description of the transaction
}, { _id: true });

const cashflowSchema = new mongoose.Schema({
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true }, // Reference to the entity associated with the cashflow
  transactions: [transactionSchema], // List of transactions associated with the cashflow
  createdAt: { type: Date, default: Date.now }, // Date when the cashflow record was created
  updatedAt: { type: Date, default: Date.now } // Date when the cashflow record was last updated
});

const Cashflow = mongoose.model('Cashflow', cashflowSchema);
module.exports = Cashflow;
