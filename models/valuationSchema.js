const mongoose = require('mongoose');

const valuationSchema = new mongoose.Schema({
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true }, // Reference to the associated entity
  projection: { type: mongoose.Schema.Types.ObjectId, ref: 'Projection', required: true }, // Reference to the associated projection
  hasReport: { type: Boolean, required: true }, // Flag indicating if the valuation has a report
  name: { type: String, required: true }, // Name of the valuation (e.g., 'Valuation 2024')
  values: {
    wacc: { type: Number, required: true }, // Weighted Average Cost of Capital (WACC)
    terminalValue: { type: Number, required: true }, // Terminal value of the entity
    pvPerpetuity: { type: Number, required: true }, // Present value of perpetuity
    enterpriseValue: { type: Number, required: true }, // Enterprise value
    discountingFactor: { type: [Number], required: true }, // Array of discounting factors
    presentValue: { type: [Number], required: true }, // Array of present values for each period
  },
  valueReport: { type: String, required: true }, // Link to the valuation report (file or URL)
  valuationDate: { type: Date, required: true }, // Date when the valuation was conducted
  validUntil: { type: Date, required: true }, // Date until which the valuation is valid
  createdAt: { type: Date, default: Date.now }, // Timestamp when the valuation record was created
  updatedAt: { type: Date, default: Date.now } // Timestamp for the last update of the valuation record
});

const Valuation = mongoose.model('Valuation', valuationSchema);
module.exports = Valuation;
