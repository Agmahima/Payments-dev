import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const baseDbUri = process.env.DB_URI || 'mongodb://localhost:27017/payments-db';

console.log("Connecting to Mongo URI:", baseDbUri);

export const baseDbConnection = mongoose.createConnection(baseDbUri, {
  ssl: baseDbUri.startsWith('mongodb+srv'), // Enable SSL for Atlas SRV URI only
});

baseDbConnection.on('connected', () => {
  console.log('✅ Connected to MongoDB successfully');
});

baseDbConnection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});
