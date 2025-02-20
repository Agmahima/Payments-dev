const mongoose = require('mongoose');
const documentSchema = new mongoose.Schema({
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
  document_type: { type: String, required: true },
  document_name: { type: String, required: true },
  uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  uploaded_on: { type: Date, default: Date.now },
});

const Document = mongoose.model('Document', documentSchema);
module.exports = Document;
