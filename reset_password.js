const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./src/models/User');

// Load env vars
dotenv.config();

const resetPassword = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const email = 'agent.smith@dca-alpha.com';
        const newPassword = 'password123';

        const user = await User.findOne({ email });

        if (!user) {
            console.log(`User ${email} not found. Creating...`);
            await User.create({
                name: 'Agent Smith',
                email: email,
                password: newPassword, // Will be hashed by pre-save hook
                role: 'AGENT',
                dcaId: 'DCA-001'
            });
            console.log('User created with new password');
        } else {
            console.log(`User found: ${user.name}`);
            user.password = newPassword; // Will be hashed by pre-save hook
            await user.save();
            console.log('Password reset successfully');
        }

        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

resetPassword();
