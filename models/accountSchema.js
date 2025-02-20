const mongoose = require('mongoose');
const { baseDbConnection } = require('../dbConnections');

const loginTokenSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  token: { type: String, required: true },
  generatedOn: { type: Date, default: Date.now },
});

const accountSchema = new mongoose.Schema({
  email: { type: String, required: true },
  primary_role: {
    type: String,
    enum: ['none', 'startup', 'investor', 'enterprise'],
    default: 'none',
  },
  landing: { type: mongoose.Schema.Types.ObjectId, refPath: 'landingType' },
  emailVerified: { type: Boolean, default: false },
  loginToken: [loginTokenSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = baseDbConnection.model('Account', accountSchema);
