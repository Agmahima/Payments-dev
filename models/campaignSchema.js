const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  _id: { type: String }, // Use _id for the custom id field
  campaign_name: { type: String, required: true },
  campaign_type: { type: String, required: true },
  launch_date: { type: Date, required: true },
  //duration: { type: Number, required: true },
  extension: [{
    seeked_on: { type: Date, required: true },
    approved_on: { type: Date, required: true },
    approver: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    days: { type: Number, required: true },
  }],
  end_date: { type: Date, required: true },
  campaign_goal: { type: Number, required: true },
  goal_type: { type: String, enum: ['strict', 'flex'], required: true },
  min_accepted: { type: Number, required: true },
  instruments: [{
    type: { type: String, required: true },
    minTicket: { type: Number, required: true },
  }],
  valuation: { type: mongoose.Schema.Types.ObjectId, ref: 'Valuation'},
  round: { type: mongoose.Schema.Types.ObjectId, ref: 'Round'},
  investments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Investment' }],
  campaign_profile: { type: mongoose.Schema.Types.ObjectId },
  dataroom: { type: mongoose.Schema.Types.ObjectId },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
  approval_required: { type: Boolean, required: true },
  approved: { type: Boolean, required: true },
  approver: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  approval_date: { type: Date },
  service_agreement: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  amount_raised: { type: Number, default: 0 },
  completion_status: { type: String, enum: ['Ongoing', 'Completed', 'Canceled'], required: true },
  campaign_access: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true },
    access_level: { type: Number, required: true },
  }]
}, {
  _id: false, // Disable the default _id
  timestamps: true,
});

const Campaign = mongoose.model('Campaign', campaignSchema);
module.exports = Campaign;
