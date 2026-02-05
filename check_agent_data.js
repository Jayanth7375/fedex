const mongoose = require('mongoose');
const User = require('./src/models/User');
const Case = require('./src/models/Case');
require('dotenv').config();

const checkAndFixAgentData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // 1. Find the Agent
        const agentEmail = 'agent.smith@dca-alpha.com';
        const agent = await User.findOne({ email: agentEmail });

        if (!agent) {
            console.error(`Agent ${agentEmail} not found!`);
            // Create if needed or strictly fail
            process.exit(1);
        }

        console.log(`Found Agent: ${agent.name} (${agent._id})`);

        // 2. Check assigned cases
        const caseCount = await Case.countDocuments({ assignedAgentId: agent._id });
        console.log(`Cases currently assigned to agent: ${caseCount}`);

        if (caseCount === 0) {
            console.log('No cases assigned. Assigning some open cases to this agent...');

            // Find unassigned or open cases
            const casesToAssign = await Case.find({ status: 'OPEN' }).limit(5);

            if (casesToAssign.length === 0) {
                console.log('No OPEN cases found to assign. Creating new mock cases...');
                // Create some if db is empty
                await Case.create([
                    {
                        caseId: 'CASE-TEST-001',
                        customerId: 'CUST-001',
                        customerName: 'John Doe',
                        amount: 1500,
                        status: 'OPEN',
                        slaDeadline: new Date(Date.now() + 86400000 * 5), // +5 days
                        priorityScore: 0.8,
                        assignedAgentId: agent._id,
                        assignedAgent: agent.name,
                        assignedDCA: agent.dcaId
                    },
                    {
                        caseId: 'CASE-TEST-002',
                        customerId: 'CUST-002',
                        customerName: 'Jane Smith',
                        amount: 3200,
                        status: 'IN_PROGRESS',
                        slaDeadline: new Date(Date.now() + 86400000 * 2), // +2 days
                        priorityScore: 0.6,
                        assignedAgentId: agent._id,
                        assignedAgent: agent.name,
                        assignedDCA: agent.dcaId
                    }
                ]);
                console.log('Created 2 new test cases assigned to agent.');
            } else {
                for (const kase of casesToAssign) {
                    kase.assignedAgentId = agent._id;
                    kase.assignedAgent = agent.name;
                    // Ensure DCA matches if relevant, or just force it for testing
                    if (agent.dcaId) kase.assignedDCA = agent.dcaId;
                    await kase.save();
                }
                console.log(`Assigned ${casesToAssign.length} existing cases to agent.`);
            }
        } else {
            console.log('Agent already has cases assigned. Data should be visible.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

checkAndFixAgentData();
