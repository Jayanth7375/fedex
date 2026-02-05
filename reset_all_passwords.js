const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./src/models/User');

// Load env vars
dotenv.config();

const resetAllPasswords = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const users = await User.find({});
        console.log(`Found ${users.length} users. Resetting passwords...`);

        for (const user of users) {
            // We explicitly mark password as modified by setting it
            // consistently to the plain text version.
            // With the User.js fix, the save() will now correctly hashing it ONCE.
            user.password = 'password123';
            await user.save();
            console.log(`Reset password for: ${user.email} (${user.role})`);
        }

        console.log('ALL passwords reset successfully to: password123');
        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

resetAllPasswords();
