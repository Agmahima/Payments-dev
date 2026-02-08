const mongoose = require('mongoose');
const { vaultDbConnection } = require('../dbConnections');

const PaymentMethodSchema = new mongoose.Schema(
  {
    user_id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true 
    },
    method_type: { 
      type: String, 
      enum: ['CARD', 'UPI', 'NET_BANKING', 'WALLET'],
      required: true,
      index: true
    },
    // Card specific fields
    card_token: { 
      type: String, 
      unique: true,
      sparse: true 
    },
    card_network: String,
    card_type: String,
    card_last4: {
      type: String,
      minlength: 4,
      maxlength: 4
    },
    card_bank_name: String,
    card_expiry: String,
    
    // UPI specific fields
    upi_id: {
      type: String,
      sparse: true
    },
    upi_handle: String,

    // Netbanking specific fields
    bank_name: String,
    bank_code: String,

    is_default: { 
      type: Boolean, 
      default: false 
    },
    is_active: {
      type: Boolean,
      default: true
    },
    last_used: Date,
    gateway: {
      type: String,
      enum: ['CASHFREE', 'RAZORPAY','STRIPE','OTHER'],
      required: true
    }
  },
  { 
    timestamps: true,
    indexes: [
      { user_id: 1, method_type: 1 },
      { card_token: 1, gateway: 1 }
    ]
  }
);

// Pre-save middleware to ensure only one default method per type per user
PaymentMethodSchema.pre('save', async function(next) {
  if (this.is_default) {
    await this.constructor.updateMany(
      { 
        user_id: this.user_id, 
        method_type: this.method_type,
        _id: { $ne: this._id }
      },
      { is_default: false }
    );
  }
  next();
});

module.exports = vaultDbConnection.model('PaymentMethod', PaymentMethodSchema);
