import mongoose, { Schema, Document } from 'mongoose';
import { vaultDbConnection } from '../dbConnections';

interface Transaction extends Document {
  transaction_mode: 'Bank Transfer' | 'Check' | 'Cash' | 'Credit Card' | 'Debit Card' | 'UPI' | 'NEFT' | 'RTGS' | 'IMPS';
  gateway_used: string;
  gateway_response: Record<string, any>;
  created_by: mongoose.Types.ObjectId;
  updated_by: mongoose.Types.ObjectId;
}

const transactionSchema = new Schema<Transaction>({
  transaction_mode: {
    type: String,
    required: true,
    enum: [
      'Bank Transfer',
      'Check',
      'Cash',
      'Credit Card',
      'Debit Card',
      'UPI',
      'NEFT',
      'RTGS',
      'IMPS',
    ],
  },
  gateway_used: {
    type: String,
    required: true,
  },
  gateway_response: {
    type: Schema.Types.Mixed,
    default: {},
    required: true,
  },
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
  },
  updated_by: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
  },
}, {
  timestamps: true,
  versionKey: true,
});

const Transaction = vaultDbConnection.model<Transaction>('Transaction', transactionSchema);
export default Transaction; 