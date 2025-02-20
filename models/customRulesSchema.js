const mongoose = require('mongoose');
const { accessDbConnection } = require('../dbConnections');

const featureSchema = new mongoose.Schema({
  feature: { type: String, required: true },
  description: { type: String, required: false },
  actions: [{
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return ["view", "edit", "delete", "create","archive"].includes(v);
      },
      message: props => `${props.value} is not a valid action!`
    }
  }]
});

const pageSchema = new mongoose.Schema({
  pageName: { type: String, required: true },
  features: [featureSchema],
});

const roleSchema = new mongoose.Schema({
  level: { type: Number, required: true },
  rules: [pageSchema],
});

const customRulesSchema = new mongoose.Schema({
  workspace_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  roles: [roleSchema],
}, { timestamps: true });

module.exports = accessDbConnection.model('CustomRules', customRulesSchema);
