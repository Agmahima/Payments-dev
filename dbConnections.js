const mongoose = require('mongoose');

// Connection URIs
const baseDbUri = process.env.BASE_DB_URI || "mongodb+srv://neelnath:XiooiSWHyHxUeunT@nucleo-devdb.ltugv6a.mongodb.net/dev-base";
const businessDbUri = process.env.BUSINESS_DB_URI || "mongodb+srv://neelnath:XiooiSWHyHxUeunT@nucleo-devdb.ltugv6a.mongodb.net/dev-business";
const loginDbUri = process.env.LOGIN_DB_URI || "mongodb+srv://neelnath:XiooiSWHyHxUeunT@nucleo-devdb.ltugv6a.mongodb.net/dev-login";
const ticketDbUri = process.env.TICKET_DB_URI || "mongodb+srv://neelnath:XiooiSWHyHxUeunT@nucleo-devdb.ltugv6a.mongodb.net/dev-tickets";
const accessDbUri = process.env.ACCESS_DB_URI || "mongodb+srv://neelnath:XiooiSWHyHxUeunT@nucleo-devdb.ltugv6a.mongodb.net/access";
const vaultDbUri = process.env.VAULT_DB_URI || "mongodb+srv://neelnath:XiooiSWHyHxUeunT@nucleo-devdb.ltugv6a.mongodb.net/dev-vault";
// Create connections
const baseDbConnection = mongoose.createConnection(baseDbUri);
const businessDbConnection = mongoose.createConnection(businessDbUri);
const loginDbConnection = mongoose.createConnection(loginDbUri);
const ticketDbConnection = mongoose.createConnection(ticketDbUri);
const accessDbConnection = mongoose.createConnection(accessDbUri);
const vaultDbConnection = mongoose.createConnection(vaultDbUri);

module.exports = { baseDbConnection, businessDbConnection, loginDbConnection, ticketDbConnection,accessDbConnection, vaultDbConnection };