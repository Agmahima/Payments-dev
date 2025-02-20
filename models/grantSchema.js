const mongoose = require('mongoose');

const grantSchema = new mongoose.Schema({
  round: { type: mongoose.Schema.Types.ObjectId, ref: 'Round', required: true }, // Reference to the funding round
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true }, // Reference to the entity receiving the grant
  amount: { type: Number, required: true }, // The amount of the grant
  awardDate: { type: Date, required: true }, // Date when the grant was awarded
  granter: { type: mongoose.Schema.Types.ObjectId, refPath: 'granterType', required: true }, // Reference to the granter (either User or Entity)
  granterType: { type: String, enum: ['User', 'Entity'], required: true }, // Type of the granter (User or Entity)
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }, // Reference to the transaction for the grant
  documents: [{
    type: { type: String, required: true }, // Type of the document (e.g., 'Contract', 'Agreement')
    doc_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true }, // Reference to the actual document
  }],
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt fields
});

const Grant = mongoose.model('Grant', grantSchema);
module.exports = Grant;
