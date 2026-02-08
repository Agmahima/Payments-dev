const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
  bank_type: { type: String, required: true }, // e.g., 'Checking', 'Savings'
  bank_account: { type: String, required: true, unique: true },
  bank_ifsc: { type: String, required: true }, // IFSC code for the bank
  bank_name: { type: String, required: true },
  branch_name: { type: String, required: true },
  verified: { type: Boolean, default: false },
  added_on: { type: Date, default: Date.now },
});

const BankAccount = mongoose.model('BankAccount', bankAccountSchema);
module.exports = BankAccount;
