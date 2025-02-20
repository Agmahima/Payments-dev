const mongoose = require('mongoose');
const { ticketDbConnection } = require('../dbConnections');
const LoginUser = require('./userSchema'); // Ensure it is loaded correctly

const TicketSchema = new mongoose.Schema({
    subject: { type: String, required: true },
    category: { type: String, required: true, enum: ['feedback', 'complaint'] },
    message: { type: String, required: true },
    status: { type: String, default: 'Open', enum: ['Open', 'In Progress', 'Resolved', 'Closed'] },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: LoginUser, default: null }, // Use modelName
    comments: [
        {
            comment: { type: String },
            commentedBy: { type: mongoose.Schema.Types.ObjectId, ref: LoginUser }, // Use modelName
            commentedAt: { type: Date, default: Date.now }
        }
    ],
    createdAt: { type: Date, default: Date.now }
});

module.exports = ticketDbConnection.model('Ticket', TicketSchema, 'tickets'); // Explicit collection name

