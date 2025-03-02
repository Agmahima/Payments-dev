import mongoose, { Schema, Document } from 'mongoose';
import { vaultDbConnection } from '../dbConnections';

interface Payment extends Document {
  request_ref: string;
  payment_purpose: string;
  payment_amount: number;
  payment_currency: string;
  payee_ref: mongoose.Types.ObjectId;
  payee_type: 'Person' | 'Entity';
  receiver_ref: mongoose.Types.ObjectId;
  receiver_type: 'Nucleo' | 'Person' | 'Entity';
  payee_location: string;
  payment_gateway: string;
  payment_status: string;
  transaction: mongoose.Types.ObjectId;
  created_by: mongoose.Types.ObjectId;
  updated_by: mongoose.Types.ObjectId;
}

const paymentSchema = new Schema<Payment>({
  request_ref: { type: String, required: true },
  payment_purpose: { type: String, required: true },
  payment_amount: { type: Number, required: true },
  payment_currency: { type: String, required: true },
  payee_ref: { type: Schema.Types.ObjectId, refPath: 'payee_type', required: true },
  payee_type: { type: String, required: true, enum: ['Person', 'Entity'] },
  receiver_ref: { type: Schema.Types.ObjectId, refPath: 'receiver_type', required: true },
  receiver_type: { type: String, required: true, enum: ['Nucleo', 'Person', 'Entity'] },
  payee_location: { type: String, required: true },
  payment_gateway: { type: String, required: true },
  payment_status: { type: String, required: true },
  transaction: { type: Schema.Types.ObjectId, ref: 'Transaction' },
  created_by: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  updated_by: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
}, { timestamps: true });

const Payment = vaultDbConnection.model<Payment>('Payment', paymentSchema);
export default Payment; 