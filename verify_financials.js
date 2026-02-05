const mongoose = require('mongoose');
const Case = require('./src/models/Case');
const User = require('./src/models/User');
const FinancialService = require('./src/services/FinancialService');
require('dotenv').config();

const runTest = async () => {
    console.log('--- FINANCIAL AUTOMATION VERIFICATION ---');
    try {
        await mongoose.connect(process.env.MONGO_URI);

        // 1. Setup Test Users
        const admin = { _id: new mongoose.Types.ObjectId(), name: 'Test Admin', role: 'ADMIN' };
        const agent = { _id: new mongoose.Types.ObjectId(), name: 'Test Agent', role: 'AGENT' };

        // 2. Create Test Case
        const caseId = `FIN-TEST-${Date.now()}`;
        console.log(`\n[1] Creating Test Case: ${caseId}`);
        const kase = await Case.create({
            caseId,
            customerId: 'C-FIN-1',
            customerName: 'Financial Test Customer',
            amount: 1000,
            slaDeadline: new Date(Date.now() + 86400000),
            status: 'OPEN'
        });

        // 3. Test Payment Flow
        console.log('\n[2] Agent Records Payment...');
        await FinancialService.recordPayment(caseId, { amount: 500, method: 'ONLINE', notes: 'Partial Pay' }, agent);

        let updatedCase = await Case.findOne({ caseId });
        const paymentId = updatedCase.paymentHistory[0]._id;
        console.log('Payment Status (Should be PENDING):', updatedCase.paymentHistory[0].status);

        console.log('\n[3] Admin Verifies Payment...');
        await FinancialService.verifyPayment(caseId, paymentId, admin, 'APPROVE');
        updatedCase = await Case.findOne({ caseId });
        console.log('Payment Status (Should be VERIFIED):', updatedCase.paymentHistory[0].status);
        console.log('Total Repaid (Should be 500):', updatedCase.totalRepaid);


        // 4. Test Settlement Flow
        console.log('\n[4] Agent Requests Settlement...');
        await FinancialService.requestSettlement(caseId, { amount: 800, remarks: 'Cant pay more' }, agent);
        updatedCase = await Case.findOne({ caseId });
        console.log('Settlement Status (Should be REQUESTED):', updatedCase.settlement.status);

        console.log('\n[5] Admin Approves Settlement...');
        await FinancialService.adjudicateSettlement(caseId, 'APPROVE', admin);
        updatedCase = await Case.findOne({ caseId });
        console.log('Settlement Status (Should be APPROVED):', updatedCase.settlement.status);
        console.log('Case Status (Should NOT be CLOSED yet, repaid 500 < 800):', updatedCase.status);

        // 5. Final Payment to Close
        console.log('\n[6] Agent Records Balance Payment (300)...');
        await FinancialService.recordPayment(caseId, { amount: 300, method: 'CASH' }, agent);
        updatedCase = await Case.findOne({ caseId });
        const paymentId2 = updatedCase.paymentHistory[1]._id;

        console.log('\n[7] Admin Verifies Final Payment...');
        await FinancialService.verifyPayment(caseId, paymentId2, admin, 'APPROVE');
        updatedCase = await Case.findOne({ caseId });

        console.log('Total Repaid:', updatedCase.totalRepaid);
        console.log('Case Status (Should be CLOSED, matched settlement):', updatedCase.status);

        // Cleanup
        await Case.deleteOne({ caseId });
        console.log('\n✅ TEST COMPLETE');

    } catch (err) {
        console.error('❌ TEST FAILED:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

runTest();
