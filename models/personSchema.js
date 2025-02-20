const mongoose = require('mongoose');
const {  baseDbConnection } = require('../dbConnections');
const personSchema = new mongoose.Schema({
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  person_name: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    middleName: { type: String },
    fullName: { type: String, required: true },
    initials: { type: String },
  },
  person_DIN: { type: String },
  person_PAN: { type: String },
  person_dob: { type: Date },
  person_occupation: [{
    entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
    role: { type: String },
    appointment_date: { type: Date },
    termination_date: { type: Date },
    isSignatory: { type: Boolean, default: false },
    
  }],
}, { collection: 'persons', timestamps: true });

module.exports = baseDbConnection.model('Person', personSchema);
