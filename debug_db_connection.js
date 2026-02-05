require('dotenv').config();
const mongoose = require('mongoose');

const debugDB = async () => {
    console.log('Starting DB Debug...');
    console.log('URI:', process.env.MONGO_URI ? 'Defined' : 'Undefined');

    mongoose.connection.on('connected', () => console.log('Mongoose connected'));
    mongoose.connection.on('error', (err) => console.error('Mongoose connection error:', err));
    mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));

    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000, // Fail fast
            socketTimeoutMS: 45000,
        });
        console.log('Connected. Running ping...');

        const admin = new mongoose.mongo.Admin(mongoose.connection.db);
        const result = await admin.ping();
        console.log('Ping result:', result);

        console.log('Attempting to find one User...');
        // We define a raw collection access to avoid schema issues for now
        const users = mongoose.connection.collection('users');
        const user = await users.findOne({});
        console.log('User found:', user ? user._id : 'None');

    } catch (error) {
        console.error('Debug script error:', error);
    } finally {
        console.log('Closing connection...');
        await mongoose.disconnect();
        console.log('Closed.');
    }
};

debugDB();
