const mongoose = require('mongoose');
const { businessDbConnection } = require('../dbConnections');

const paymentMethodSchema = new mongoose.Schema({
    type: { 
        type: String, 
        enum: ['UPI', 'NETBANKING', 'CARD', 'WALLET', 'EMI'],
        required: true 
    },
    enabled: { 
        type: Boolean, 
        default: true 
    },
    displayName: { 
        type: String, 
        required: true 
    },
    icon: { 
        type: String 
    },
    gatewaySpecificCode: { 
        type: String, 
        required: true 
    },
    minAmount: { 
        type: Number, 
        default: 0 
    },
    maxAmount: { 
        type: Number 
    }
});

const paymentGatewaySchema = new mongoose.Schema({
    gateway_name: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String 
    },
    gatewayIdentifier: { 
        type: String, 
        required: true, 
        unique: true 
    },
    logoUrl: { 
        type: String 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    priority: { 
        type: Number, 
        default: 0 
    },
    supportedRegions: [{
        country: { 
            type: String, 
            required: true 
        },
        currency: { 
            type: String, 
            required: true 
        },
        isActive: { 
            type: Boolean, 
            default: true 
        }
    }],
    paymentMethods: [paymentMethodSchema],
    transactionFees: {
        percentage: { 
            type: Number, 
            default: 0 
        },
        flatFee: { 
            type: Number, 
            default: 0 
        }
    },
    config: {
        mode: { 
            type: String, 
            enum: ['sandbox', 'production'], 
            required: true 
        },
        sandbox: {
            apiKey: String,
            secretKey: String,
            webhookSecret: String,
            webhookUrl: String,
            redirectUrl: String,
            apiBaseUrl: String
        },
        production: {
            apiKey: String,
            secretKey: String,
            webhookSecret: String,
            webhookUrl: String,
            redirectUrl: String,
            apiBaseUrl: String
        }
    },
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Person',
        required: true 
    },
    updatedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Person' 
    }
}, {
    timestamps: {
        createdAt: 'createdTs',
        updatedAt: 'updatedTs'
    }
});

// Indexes for better query performance
paymentGatewaySchema.index({ gatewayIdentifier: 1 });
paymentGatewaySchema.index({ isActive: 1 });
paymentGatewaySchema.index({ 'supportedRegions.country': 1 });

// Method to get active payment methods for a region
paymentGatewaySchema.methods.getActivePaymentMethods = function(amount) {
    return this.paymentMethods.filter(method => 
        method.enabled && 
        amount >= method.minAmount && 
        (!method.maxAmount || amount <= method.maxAmount)
    );
};

// Static method to find available gateways for a region
paymentGatewaySchema.statics.findAvailableGateways = function(country, currency) {
    return this.find({
        isActive: true,
        'supportedRegions': {
            $elemMatch: {
                country: country,
                currency: currency,
                isActive: true
            }
        }
    });
};

module.exports = businessDbConnection.model('PaymentGateway', paymentGatewaySchema);
