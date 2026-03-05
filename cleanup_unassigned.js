const mongoose = require('mongoose');
const Case = require('./src/models/Case');
require('dotenv').config();

const cleanupUnassigned = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // Find unassigned cases
        const unassignedCases = await Case.find({ assignedDCA: null });

        if (unassignedCases.length === 0) {
            console.log('No unassigned cases found to delete.');
        } else {
            console.log(`Found ${unassignedCases.length} unassigned cases.`);

            for (const kase of unassignedCases) {
                console.log(`Deleting Case: ${kase.caseId} (${kase.customerName}) - Region: ${kase.region}`);
                await Case.deleteOne({ _id: kase._id });
            }
            console.log('Cleanup complete.');
        }

    } catch (err) {
        console.error('ERROR:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

cleanupUnassigned();
