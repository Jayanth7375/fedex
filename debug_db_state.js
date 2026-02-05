const mongoose = require('mongoose');
const dotenv = require('dotenv');
const DCA = require('./src/models/DCA');
const Case = require('./src/models/Case');

dotenv.config();

const debugState = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // 1. Fetch Latest Case
        const latestCase = await Case.findOne().sort({ createdAt: -1 });
        if (!latestCase) {
            console.log('No cases found.');
        } else {
            console.log('--- LATEST CASE ---');
            console.log(`ID: ${latestCase.caseId}`);
            console.log(`Region: '${latestCase.region}'`);
            console.log(`AssignedDCA: ${latestCase.assignedDCA}`);
        }

        // 2. Fetch All DCAs
        const dcas = await DCA.find({});
        console.log('\n--- DCAs ---');
        dcas.forEach(dca => {
            console.log(`Name: ${dca.name}`);
            console.log(`Status: ${dca.status}`);
            console.log(`Legacy Region: '${dca.region}'`);
            console.log(`Supported Regions:`, dca.supportedRegions);
            console.log('----------------');
        });

        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

debugState();
