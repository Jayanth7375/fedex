const mongoose = require('mongoose');
const Case = require('./src/models/Case');
const BREService = require('./src/services/BREService');
require('dotenv').config();

const verify = async () => {
    console.log('--- BRE VERIFICATION START ---');
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // 1. Test Auto-Progress (OPEN -> IN_PROGRESS)
        console.log('\n[1] Testing Auto-Progress...');
        const caseId1 = `TEST-AUTO-${Date.now()}`;
        const kase1 = await Case.create({
            caseId: caseId1,
            amount: 1000,
            slaDeadline: new Date(Date.now() + 86400000 * 5), // 5 days from now
            status: 'OPEN',
            customerName: 'Auto Verify Subject',
            customerId: 'C-TEST-1',
            activityLogs: [],
            notes: [],
            paymentHistory: []
        });
        console.log(`Created Case ${caseId1} [OPEN]`);

        // Simulate Agent Action
        await BREService.checkAutoProgress(caseId1, { _id: 'TEST_USER', name: 'Test Agent' });

        const updatedKase1 = await Case.findOne({ caseId: caseId1 });
        if (updatedKase1.status === 'IN_PROGRESS') {
            console.log('✅ PASS: Case moved to IN_PROGRESS after check');
        } else {
            console.error(`❌ FAIL: Case is ${updatedKase1.status}`);
        }

        // 2. Test SLA Breach
        console.log('\n[2] Testing SLA Breach...');
        const caseId2 = `TEST-SLA-${Date.now()}`;
        const kase2 = await Case.create({
            caseId: caseId2,
            amount: 500,
            slaDeadline: new Date(Date.now() - 3600000), // 1 hour ago (BREACHED)
            status: 'OPEN',
            customerName: 'SLA Verify Subject',
            customerId: 'C-TEST-2',
            activityLogs: [],
            notes: [],
            paymentHistory: []
        });
        console.log(`Created Case ${caseId2} [OPEN] with Past Deadline`);

        // Run SLA Evaluation
        await BREService.evaluateSLA(kase2);

        const updatedKase2 = await Case.findOne({ caseId: caseId2 });
        if (updatedKase2.status === 'SLA_BREACHED') {
            console.log('✅ PASS: Case moved to SLA_BREACHED');
        } else {
            console.error(`❌ FAIL: Case is ${updatedKase2.status}`);
        }

        // Cleanup
        await Case.deleteOne({ caseId: caseId1 });
        await Case.deleteOne({ caseId: caseId2 });
        console.log('\nCleanup complete.');

    } catch (err) {
        console.error('Test Failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('--- BRE VERIFICATION END ---');
        process.exit();
    }
};

verify();
