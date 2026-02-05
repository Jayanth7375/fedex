const mongoose = require('mongoose');
const User = require('./src/models/User');
const DCA = require('./src/models/DCA');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fedex_dca_db');
        console.log('MongoDB Connected');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

const setupAgent = async () => {
    await connectDB();

    const dcaCode = 'DCA-ALP'; // Verify this matches your DCA
    const region = 'EAST';

    // 1. Ensure DCA exists
    let dca = await DCA.findOne({ code: dcaCode });
    if (!dca) {
        // Try finding any DCA
        dca = await DCA.findOne();
        if (!dca) {
            console.log('No DCA found. Create one first.');
            process.exit();
        }
        console.log(`Using DCA: ${dca.name} (${dca.code})`);
    }

    // 2. Create or Update Agent
    const agentEmail = 'agent.east@dca.com';
    let agent = await User.findOne({ email: agentEmail });

    if (!agent) {
        agent = await User.create({
            name: 'Test Agent East',
            email: agentEmail,
            password: 'password123',
            role: 'AGENT', // or DCA_AGENT depending on your enum
            dcaId: dca.code,
            status: 'ACTIVE',
            supportedRegions: [region],
            region: region
        });
        console.log('Created New Agent:', agent.name);
    } else {
        agent.supportedRegions = [region];
        agent.dcaId = dca.code;
        agent.status = 'ACTIVE';
        await agent.save();
        console.log('Updated Existing Agent:', agent.name);
    }

    console.log(`\nReady to Test!`);
    console.log(`1. Agent '${agent.name}' is assigned to '${dca.code}'`);
    console.log(`2. Agent supports region: '${region}'`);
    console.log(`3. Import a case with Region='${region}' and it should be assigned to this agent.`);

    process.exit();
};

setupAgent();
