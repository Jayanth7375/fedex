require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const bcrypt = require('bcryptjs');

const run = async () => {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');

        const email = 'admin@fedex.com'; // Trying a likely default
        console.log(`Searching for user: ${email}`);
        const user = await User.findOne({ email });

        if (!user) {
            console.log('User not found.');
            process.exit(0);
        }

        console.log('User found:', user.name, user.role);
        console.log('Password hash:', user.password);

        const isMatch = await bcrypt.compare('admin123', user.password);
        console.log('Password match check (admin123):', isMatch);

    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        await mongoose.disconnect();
    }
};

run();
