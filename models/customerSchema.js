const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
  customer_type: { type: String, required: true }, // Type of customer (e.g., 'B2B', 'B2C')
  customer_role: { type: String, required: true }, // Role of the customer (e.g., 'Client', 'Partner')
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'customer_type', // Dynamic reference based on customer_type (can reference User or Entity)
    required: true
  },
  customer_testimony: { type: String, required: true }, // Testimony from the customer
  customer_since: { type: Date, default: Date.now } // Date when the customer started the relationship
});

const Customer = mongoose.model('Customer', customerSchema);
module.exports = Customer;
