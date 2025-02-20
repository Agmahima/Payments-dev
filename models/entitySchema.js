const mongoose = require('mongoose');
const { businessDbConnection } = require('../dbConnections');

const entitySchema = new mongoose.Schema({
  entity_name: { type: String, required: true },
  entity_type: { type: String, required: true },
  identification_number: { type: String, required: true },
  incorporation_date: { type: Date },
  registrar: { type: String },
  registration_number: { type: String },
  mca_compliance_status: { type: String },
  mca_efile_status: { type: String },
  registered_address: { type: String },
  registered_email: { type: String },
  registered_phone: { type: String },
  entity_signatories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Person' }],
  documents: [{
    doc: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    doc_type: { type: String },
  }],
  kyb_verifications: [{ type: mongoose.Schema.Types.ObjectId, ref: 'KYB' }],
});

module.exports = businessDbConnection.model('Entity', entitySchema);

