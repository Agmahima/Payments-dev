const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
  id: { type: String, required: true }, // Unique identifier for the entry
  label: { type: String, required: true }, // Label for the entry (e.g., 'Revenue', 'Expenses')
  type: { type: String, required: true }, // Type of the entry (e.g., 'Income', 'Expense')
  values: { type: [Number], required: true } // Array of numeric values for the projections over the years
}, { _id: false });

const projectionSchema = new mongoose.Schema({
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true }, // Reference to the entity associated with the projection
  name: { type: String, required: true }, // Name of the projection (e.g., 'Financial Projection 2024')
  start_year: { type: Number, required: true }, // Starting year of the projection
  tax_rate: { type: Number, required: true }, // Tax rate to be applied
  years: { type: Number, required: true }, // Number of years the projection covers
  entries: [entrySchema], // Array of entries (e.g., revenue, expenses) in the projection
  createdAt: { type: Date, default: Date.now } // Timestamp when the projection record was created
});

const Projection = mongoose.model('Projection', projectionSchema);
module.exports = Projection;
