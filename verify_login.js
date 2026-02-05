require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const connectDB = require('./src/config/db');
const bcrypt = require('bcryptjs');

const verifyLogin = async () => {
    try {
        await connectDB();
        const email = 'manager@dca-alpha.com';
        const password = 'password123';

        console.log(`Attempting to verify user: ${email}`);
        const user = await User.findOne({ email });

        if (!user) {
            console.log('User NOT FOUND');
            process.exit(1);
        }

        console.log(`User found: ${user.name}`);
        console.log(`Stored Password Hash: ${user.password}`);

        const isMatch = await bcrypt.compare(password, user.password);
        console.log(`Password Match Result for '${password}': ${isMatch}`);

        if (isMatch) {
            console.log('SUCCESS: Credentials are valid.');
        } else {
            console.log('FAILURE: Password comparison failed.');
        }

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

verifyLogin();
