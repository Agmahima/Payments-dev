"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.baseDbConnection = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const baseDbUri = process.env.DB_URI || 'mongodb://localhost:27017/payments-db';
console.log("Connecting to Mongo URI:", baseDbUri);
exports.baseDbConnection = mongoose_1.default.createConnection(baseDbUri, {
    ssl: baseDbUri.startsWith('mongodb+srv'), // Enable SSL for Atlas SRV URI only
});
exports.baseDbConnection.on('connected', () => {
    console.log('✅ Connected to MongoDB successfully');
});
exports.baseDbConnection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
});
