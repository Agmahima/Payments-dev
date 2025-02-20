const mongoose = require('mongoose');
const { loginDbConnection } = require('../dbConnections');

const userSchema = new mongoose.Schema({
    email: { type: String, unique: true }, // Ensure emails are unique
    first_name: { type: String },
    last_name: { type: String },
    middle_name: { type: String },
    full_name: { type: String },
    role: {
        type: String,
        enum: ['admin', 'super admin', 'viewer'], // Restrict to allowed roles
        required: true
    }
});

// Add index to improve query performance
userSchema.index({ email: 1 });

module.exports = loginDbConnection.model('LoginUser', userSchema); // Ensure 'LoginUser' is exactly as used
