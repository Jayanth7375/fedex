require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const Case = require('./src/models/Case');
const ActivityLog = require('./src/models/ActivityLog');

const seedData = async () => {
    await connectDB();

    try {
        await User.deleteMany();
        await Case.deleteMany();
        await ActivityLog.deleteMany();

        console.log('Data Destroyed...');

        console.log('Data Destroyed...');

        // Create users using a loop to ensure pre-save hooks (hashing) trigger
        const usersToCreate = [
            { name: 'FedEx Admin', email: 'admin@fedex.com', password: 'password123', role: 'ADMIN' },
            { name: 'DCA Manager (Alpha)', email: 'manager@dca-alpha.com', password: 'password123', role: 'MANAGER', dcaId: 'DCA-Alpha' },
            { name: 'Agent Smith', email: 'agent.smith@dca-alpha.com', password: 'password123', role: 'AGENT', dcaId: 'DCA-Alpha' },
            { name: 'Agent Jones', email: 'agent.jones@dca-alpha.com', password: 'password123', role: 'AGENT', dcaId: 'DCA-Alpha' }
        ];

        const createdUsers = [];
        for (const userData of usersToCreate) {
            const user = new User(userData);
            await user.save();
            createdUsers.push(user);
        }

        console.log('Users Created');

        const manager = createdUsers[1];
        const agentSmith = createdUsers[2];

        const cases = await Case.create([
            {
                caseId: 'CASE-1001',
                customerId: 'CUST-001',
                customerName: 'John Doe',
                amount: 5400.00,
                status: 'OPEN',
                slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // +1 day
                priorityScore: 0.85,
                assignedDCA: 'DCA-Alpha',
                assignedAgent: agentSmith.name,
                assignedAgentId: agentSmith._id,
                recoveryProbability: 0.75,
                notes: [
                    { author: 'System', content: 'Case imported from mainframe.', timestamp: new Date() }
                ]
            },
            {
                caseId: 'CASE-1002',
                customerId: 'CUST-002',
                customerName: 'Jane Smith',
                amount: 1250.50,
                status: 'IN_PROGRESS',
                slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000), // +2 days
                priorityScore: 0.60,
                assignedDCA: 'DCA-Alpha',
                assignedAgent: agentSmith.name,
                assignedAgentId: agentSmith._id,
                recoveryProbability: 0.60
            },
            {
                caseId: 'CASE-1003',
                customerId: 'CUST-003',
                customerName: 'Robert Johnson',
                amount: 15000.00,
                status: 'SLA_BREACHED',
                slaDeadline: new Date(Date.now() - 5 * 60 * 60 * 1000), // -5 hours
                priorityScore: 0.95,
                assignedDCA: 'DCA-Alpha',
                assignedAgent: null,
                recoveryProbability: 0.40
            },
            {
                caseId: 'CASE-1004',
                customerId: 'CUST-004',
                customerName: 'Emily Davis',
                amount: 3200.00,
                status: 'CLOSED',
                slaDeadline: new Date(Date.now() - 72 * 60 * 60 * 1000),
                priorityScore: 0.20,
                assignedDCA: 'DCA-Beta',
                assignedAgent: null,
                totalRepaid: 3200.00,
                recoveryProbability: 1.0
            },
            {
                caseId: 'CASE-1005',
                customerId: 'CUST-001', // History for John Doe
                customerName: 'John Doe',
                amount: 1000.00,
                status: 'CLOSED',
                slaDeadline: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
                priorityScore: 0.10,
                assignedDCA: 'DCA-Alpha',
                totalRepaid: 1000.00,
                recoveryProbability: 1.0,
                paymentHistory: [
                    { amount: 1000, date: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000), status: 'SUCCESS' }
                ]
            },
            {
                caseId: 'CASE-1006',
                customerId: 'CUST-005',
                customerName: 'Michael Brown',
                amount: 7500.00,
                status: 'OPEN',
                slaDeadline: new Date(Date.now() + 12 * 60 * 60 * 1000), // +12 hours
                priorityScore: 0.88,
                assignedDCA: 'DCA-Beta',
                assignedAgent: null,
                recoveryProbability: 0.65
            }
        ]);

        console.log('Cases Created');

        await ActivityLog.create([
            {
                caseId: 'CASE-1001',
                action: 'CASE_IMPORT',
                user: 'System',
                userId: createdUsers[0]._id, // Admin
                details: 'Initial import of case',
                timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
            },
            {
                caseId: 'CASE-1001',
                action: 'STATUS_UPDATE',
                user: agentSmith.name,
                userId: agentSmith._id,
                details: 'Opened investigation',
                timestamp: new Date()
            }
        ]);

        console.log('Activity Logs Created');

        console.log('Data Imported!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

seedData();
