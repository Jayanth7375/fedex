const mongoose = require('mongoose');
const Case = require('./src/models/Case');
const User = require('./src/models/User');
require('dotenv').config();

const testAssign = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        // 1. Create a potential Manager and Agent
        const dcaId = "DCA001";

        // Ensure Manager
        let manager = await User.findOne({ email: 'manager@test.com' });
        if (!manager) {
            manager = await User.create({
                name: 'Test Manager',
                email: 'manager@test.com',
                password: 'password123',
                role: 'MANAGER',
                dcaId: dcaId
            });
        }

        // Ensure Agent
        let agent = await User.findOne({ email: 'agent@test.com' });
        if (!agent) {
            agent = await User.create({
                name: 'Test Agent',
                email: 'agent@test.com',
                password: 'password123',
                role: 'AGENT',
                dcaId: dcaId
            });
        }

        // Create Case
        const caseId = `TEST-ASSIGN-${Date.now()}`;
        const kase = await Case.create({
            caseId,
            customerId: 'C1',
            customerName: 'Test',
            amount: 100,
            slaDeadline: new Date(),
            assignedDCA: dcaId,
            status: 'OPEN'
        });

        console.log('--- PRE-ASSIGN CHECK ---');
        console.log('Manager DCA:', manager.dcaId);
        console.log('Agent DCA:', agent.dcaId);
        console.log('Case DCA:', kase.assignedDCA);

        // Simulate Controller Logic
        console.log('--- SIMULATING LOGIC ---');

        const reqUser = manager;
        const reqBody = { agentName: agent.name, agentId: agent._id.toString() };

        if (reqUser.role === 'MANAGER') {
            const foundAgent = await User.findById(reqBody.agentId);
            if (!foundAgent) throw new Error('Agent not found');

            console.log('Agent Found:', foundAgent.name);

            if (String(foundAgent.dcaId) !== String(reqUser.dcaId)) {
                throw new Error('DCA Mismatch (Agent vs Manager)');
            }

            if (kase.assignedDCA !== reqUser.dcaId) {
                throw new Error(`Case DCA Mismatch: Case=${kase.assignedDCA} User=${reqUser.dcaId}`);
            }
        }

        kase.assignedAgent = reqBody.agentName;
        kase.assignedAgentId = reqBody.agentId;
        await kase.save();
        console.log('--- SUCCESS ---');

    } catch (error) {
        console.error('--- FAIL ---');
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

testAssign();
