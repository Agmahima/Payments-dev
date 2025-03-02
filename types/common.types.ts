import { Document, Types } from 'mongoose';


export interface RecordFilingSchema extends Document {
  _id: Types.ObjectId;
  entity_ref: Types.ObjectId;
  recordfiling_name: string;
  recordfiling_type: string;
  form_name: string;
  recordfiling_regulator: string;
  recordfiling_date: Date | string;
  challengePeriodEnd: Date | string;
  recordfiling_fy: string;
  recordfiling_ay: string;
  recordfiling_reftype: string; //campaign, round etc.
  recordfiling_ref: Types.ObjectId; //ref to where it was initiated from
  record_documents: Types.ObjectId[]; //ref to document id
  created_by: Types.ObjectId; //account ref
  updated_by: Types.ObjectId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  _v?: number;
}
export interface PersonSchema extends Document {
  _id: Types.ObjectId;
  person_name: {
    fullname: string;
    firstName: string;
    middleName: string;
    lastName: string;
  };
  person_din: string;
  person_pan: string;
  person_dob: Date | string;
  person_occupation: {
    employements: {
      entity_ref: Types.ObjectId; //ref to entity id; use ObjectId not string
      employment_type: string; //full-time, part-time, contractual, retainer
      designation: string;
      role_brief: string;
      appointment_date: Date | string;
      resignation_date: Date | string;
      isSignatory: boolean;
      employement_documents: Types.ObjectId[]; // ref to document id
    }[];
    directorships: {
      entity_ref: Types.ObjectId; //ref to entity id; use ObjectId not string
      designation: string;
      role_brief: string;
      appointment_date: Date | string;
      resignation_date: Date | string;
      isSignatory: boolean;
      directorship_documents: Types.ObjectId[]; // ref to document id
    }[];
  };
  created_by: Types.ObjectId; //account ref
  updated_by: Types.ObjectId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
export interface DocumentSchema extends Document {
  _id: Types.ObjectId;
  document_name: string;
  document_type: string;
  document_refno: string;
  document_src: string; //link to document location
  generated_uploaded: string;
  is_confidential: boolean;
  is_regulatory: boolean;
  has_signatures: boolean;
  mandatory_storage: boolean;
  storage_period: number; //months
  signatories: Types.ObjectId[]; //ref to person id
  created_by: Types.ObjectId; //account ref
  updated_by: Types.ObjectId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
export interface PaymentSchema extends Document {
  _id: Types.ObjectId;
  request_ref: string; //service that has requested payment
  payment_purpose: string; //investment, subscription, service
  payment_amount: number;
  payment_currency: string;
  payee_ref: Types.ObjectId; //person or entity ref id
  receiver_ref: Types.ObjectId; //nucleo or person/entity id
  payee_location: string;
  payment_gateway: string;
  payment_status: string;
  transaction: Types.ObjectId; //ref id to transaction
  created_by: Types.ObjectId; //account ref
  updated_by: Types.ObjectId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
export interface TransactionSchema extends Document {
  _id: Types.ObjectId;
  transaction_mode: string; //'bank-transfer' | 'check' | 'cash' | 'card' | 'upi' etc
  gateway_used: string;
  gateway_response: Record<string, any>;
  created_by: Types.ObjectId; //account ref
  updated_by: Types.ObjectId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}