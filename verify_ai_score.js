const mongoose = require('mongoose');
const Case = require('./src/models/Case');
const AIService = require('./src/services/AIService');
require('dotenv').config();

const verifyAI = async () => {
    console.log('--- AI SCORING VERIFICATION ---');
    try {
        await mongoose.connect(process.env.MONGO_URI);

        // Scenario 1: High Risk Case (Amount > 2000, SLA < 48h)
        const caseId1 = `AI-TEST-HIGH-${Date.now()}`;
        console.log(`\n[1] Creating High Risk Case: ${caseId1}`);
        const kase1 = await Case.create({
            caseId: caseId1,
            amount: 5000, // +20
            slaDeadline: new Date(Date.now() + 3600000 * 24), // 24h from now (+20), also Priority TRIGGER
            status: 'OPEN',
            customerName: 'AI Test High',
            customerId: 'C-AI-1',
            createdAt: new Date()
        });

        // Run Scoring
        const result1 = await AIService.runScoring(kase1);
        console.log('Result 1:', result1);

        if (result1.riskScore >= 40 && result1.priority === 'HIGH') {
            console.log('✅ PASS: Detected High Risk & High Priority');
        } else {
            console.error('❌ FAIL: Score/Priority mismatch');
        }

        // Scenario 2: Low Risk Case
        const caseId2 = `AI-TEST-LOW-${Date.now()}`;
        console.log(`\n[2] Creating Low Risk Case: ${caseId2}`);
        const kase2 = await Case.create({
            caseId: caseId2,
            amount: 100,
            slaDeadline: new Date(Date.now() + 3600000 * 24 * 10), // 10 days
            status: 'OPEN',
            customerName: 'AI Test Low',
            customerId: 'C-AI-2',
            createdAt: new Date()
        });

        const result2 = await AIService.runScoring(kase2);
        console.log('Result 2:', result2);

        if (result2.riskScore < 30 && result2.priority === 'LOW') {
            console.log('✅ PASS: Detected Low Risk & Priority');
        } else {
            console.error('❌ FAIL: Score/Priority mismatch');
        }

        // Cleanup
        await Case.deleteOne({ caseId: caseId1 });
        await Case.deleteOne({ caseId: caseId2 });
        console.log('\nCleanup complete.');

    } catch (err) {
        console.error('Test Failed:', err);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

verifyAI();
