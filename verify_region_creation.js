const mongoose = require('mongoose');
const Case = require('./src/models/Case');
const caseController = require('./src/controllers/case.controller');
const httpMocks = require('node-mocks-http');
const EventEmitter = require('events');
require('dotenv').config();

const verifyRegionCreation = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const req = httpMocks.createRequest({
            method: 'POST',
            url: '/api/cases',
            body: {
                customerName: 'Region Auto Test User',
                amount: 1000,
                slaDeadline: new Date(Date.now() + 86400000), // Tomorrow
                priorityScore: 0.8,
                region: 'CENTRAL', // Should match Test DCA
                customerId: 'TEST-REG-AUTO'
            },
            user: {
                name: 'Test Admin',
                _id: new mongoose.Types.ObjectId(),
                role: 'ADMIN'
            }
        });

        const res = httpMocks.createResponse({
            eventEmitter: EventEmitter
        });

        res.on('end', async () => {
            const data = res._getJSONData();
            console.log('Response Status:', res.statusCode);
            console.log('Created Case ID:', data.caseId);

            const kase = await Case.findOne({ caseId: data.caseId });
            console.log(`Region: ${kase.region}`);
            console.log(`AssignedDCA: ${kase.assignedDCA}`);
            console.log(`Status: ${kase.status}`);

            if (kase.assignedDCA) {
                console.log('SUCCESS: Immediate Assignment worked!');
            } else {
                console.log('WARNING: Not assigned (check if DCA exists for Central)');
            }

            // Cleanup
            await Case.deleteOne({ _id: kase._id });
            await mongoose.disconnect();
            process.exit();
        });

        await caseController.createCase(req, res);

    } catch (err) {
        console.error('ERROR:', err);
        await mongoose.disconnect();
        process.exit();
    }
};

verifyRegionCreation();
