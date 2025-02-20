const mongoose = require('mongoose');
const kybSchema = new mongoose.Schema({
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
  kyb_type: { type: String, required: true },
  kyb_input: { type: String, required: true },
  kyb_verified: { type: Boolean, default: false },
  kyb_document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
});

const KYB = mongoose.model('KYB', kybSchema);
module.exports = KYB;
