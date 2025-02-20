const mongoose = require('mongoose');
const {loginDbConnection} = require('../dbConnections');

const accessRequestSchema = new mongoose.Schema({
    email:{type:String, required:true, unique:true},
    // first_name:{type: String, required:true},
    // last_name:{type: String, required:true},
    // middle_name:{type: String},
    status:{
        type:String,
        enum:["pending", "approved", "rejected"],
        default:"pending",
    },
    created_at:{type:Date, default:Date.now},
});

// Add an index on the email field to speed up lookups
accessRequestSchema.index({email:1});

module.exports = loginDbConnection.model('AccessRequest',accessRequestSchema);