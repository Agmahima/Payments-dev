const mongoose = require('mongoose');
const { accessDbConnection } = require('../dbConnections');

const workspaceSchema = new mongoose.Schema({
  entity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Entity',
    required: true
  },
  workspace_type: {
    type: String,
    required: true,
    
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  access: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
      required: true
    },
    level: {
      type: Number,
      required: true,

    }
  }],
  created_on: {
    type: Date,
    default: Date.now
  },
  updated_on: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'workspace',
  timestamps: {
    createdAt: 'created_on',
    updatedAt: 'updated_on'
  }
});

module.exports = accessDbConnection.model('Workspace', workspaceSchema);