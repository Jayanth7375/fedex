const mongoose = require('mongoose');
const dotenv = require('dotenv');
const DCA = require('./src/models/DCA');
const User = require('./src/models/User');

dotenv.config();

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for Migration');

        // Migrate DCAs
        const dcas = await DCA.find({});
        console.log(`Found ${dcas.length} DCAs to migrate.`);
        for (const dca of dcas) {
            // Force update if supportedRegions is empty OR if we just want to ensure sync
            // For safety, let's only touch ones that look unmigrated
            if (!dca.supportedRegions || dca.supportedRegions.length === 0) {
                let region = dca.region || 'CENTRAL';
                region = region.toUpperCase();

                // Explicitly mark modified
                dca.region = region;
                dca.supportedRegions = [region];

                const res = await dca.save();
                console.log(`Migrated DCA ${dca.name}: Legacy=${region}, Supported=${dca.supportedRegions}`);
            } else {
                console.log(`Skipping DCA ${dca.name}: Already has ${dca.supportedRegions}`);
            }
        }

        // Migrate Agents (Users)
        const agents = await User.find({ role: 'AGENT' });
        console.log(`Found ${agents.length} Agents to migrate.`);
        for (const agent of agents) {
            if (!agent.supportedRegions || agent.supportedRegions.length === 0) {
                let region = agent.region || 'CENTRAL';
                region = region.toUpperCase();
                agent.region = region; // FIX: Update legacy field
                agent.supportedRegions = [region];
                await agent.save();
                console.log(`Migrated Agent ${agent.name}: ${agent.supportedRegions}`);
            }
        }

        console.log('Migration Complete.');
        process.exit();
    } catch (error) {
        console.error('Migration Failed:', error);
        process.exit(1);
    }
};

migrate();
