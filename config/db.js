const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('DUUUUUDEEEEE MongoDB Connected');
    } catch (err) {
        console.error('NAAAHHHH!!! Connection Error:', err);
        process.exit(1);
    }
};

module.exports = connectDB;

