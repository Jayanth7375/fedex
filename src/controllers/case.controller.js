const Case = require('../models/Case');
const ActivityLog = require('../models/ActivityLog'); // Keep for read if needed, but writes go through BRE
const BREService = require('../services/BREService');
const KPIService = require('../services/KPIService');
const AIService = require('../services/AIService');
const FinancialService = require('../services/FinancialService');
const User = require('../models/User');


// @desc    Get all cases (role filtered details)
// @route   GET /api/cases
// @access  Private
const getCases = async (req, res) => {
    try {
        let query = {};

        // Role-based filtering
        if (req.user.role === 'MANAGER' || req.user.role === 'DCA_MANAGER') {
            // STRICT SCOPING: Managers must have a dcaId to see anything
            if (!req.user.dcaId) {
                return res.json([]); // Return empty if no DCA assigned
            }
            query.assignedDCA = req.user.dcaId;
        } else if (req.user.role === 'AGENT' || req.user.role === 'DCA_AGENT') {
            // Agents only see cases assigned to them
            query.assignedAgentId = req.user._id;
        }

        // Search features
        if (req.query.status) {
            query.status = req.query.status;
        }

        const cases = await Case.find(query).sort({ priorityScore: -1 });
        res.json(cases);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get case detail
// @route   GET /api/cases/:id
// @access  Private
const getCaseById = async (req, res) => {
    try {
        const kase = await Case.findOne({ caseId: req.params.id }).populate('activityLogs');

        if (!kase) {
            return res.status(404).json({ message: 'Case not found' });
        }

        // RBAC Check for Detail View
        if (req.user.role === 'AGENT' && kase.assignedAgentId && kase.assignedAgentId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to view this case' });
        }

        // Real-time SLA Check (Fail-safe)
        await BREService.evaluateSLA(kase);

        // Masking logic for Agents
        let caseData = kase.toObject();
        if (req.user.role !== 'ADMIN') {
            // Mask Customer Name
            caseData.customerName = kase.customerName.replace(/^[A-Za-z]+/, (match) => match[0] + '*'.repeat(match.length - 1));
        }

        res.json(caseData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update case status
// @route   PUT /api/cases/:id/status
// @access  Private
const updateCaseStatus = async (req, res) => {
    try {
        const { status, note } = req.body;
        const kase = await Case.findOne({ caseId: req.params.id });

        if (!kase) {
            return res.status(404).json({ message: 'Case not found' });
        }

        const oldStatus = kase.status;
        kase.status = status;

        if (note) {
            kase.notes.push({
                author: req.user.name,
                content: note,
                timestamp: new Date()
            });
        }

        await kase.save();

        // Log Activity
        await BREService.logActivity({
            caseId: kase.caseId,
            action: 'STATUS_UPDATE',
            user: req.user.name,
            userId: req.user._id,
            details: `Status updated from ${oldStatus} to ${status}`
        });

        res.json(kase);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Assign case (Manager only)
// @route   PUT /api/cases/:id/assign
// @access  Private/Manager
const assignCase = async (req, res) => {
    try {
        console.log(`[ASSIGN] Attempting to assign case ${req.params.id}`);
        const { agentName, agentId } = req.body;
        console.log(`[ASSIGN] Payload:`, { agentName, agentId });

        const kase = await Case.findOne({ caseId: req.params.id });

        if (!kase) {
            console.log(`[ASSIGN] Case not found`);
            return res.status(404).json({ message: 'Case not found' });
        }

        // Security Check: If Manager, ensure Agent belongs to their DCA
        if (req.user.role === 'MANAGER' || req.user.role === 'DCA_MANAGER') {
            console.log(`[ASSIGN] Manager Check: User DCA=${req.user.dcaId}`);

            // Require User model here if not at top, or move to top. 
            // Better to rely on top-level require, but safety check:
            const User = require('../models/User');

            const agent = await User.findById(agentId);

            if (!agent) {
                console.log(`[ASSIGN] Agent not found in DB`);
                return res.status(404).json({ message: 'Agent not found' });
            }

            console.log(`[ASSIGN] Agent DCA=${agent.dcaId}`);

            // Ensure types match for comparison (Strings usually)
            if (String(agent.dcaId) !== String(req.user.dcaId)) {
                console.log(`[ASSIGN] DCA Mismatch`);
                return res.status(403).json({ message: 'Cannot assign agents from other DCAs' });
            }

            // Also ensure the case belongs to this DCA
            if (kase.assignedDCA !== req.user.dcaId) {
                console.log(`[ASSIGN] Case DCA Mismatch: Case=${kase.assignedDCA}, User=${req.user.dcaId}`);
                return res.status(403).json({ message: 'Cannot assign cases not assigned to your DCA' });
            }
        }

        kase.assignedAgent = agentName;
        kase.assignedAgentId = agentId;

        // Auto-status update
        if (kase.status === 'OPEN') {
            kase.status = 'IN_PROGRESS';
        }

        await kase.save();
        console.log(`[ASSIGN] Success`);

        await BREService.logActivity({
            caseId: kase.caseId,
            action: 'CASE_ASSIGN',
            user: req.user.name,
            userId: req.user._id,
            details: `Assigned to ${agentName}`
        });

        res.json(kase);
    } catch (error) {
        console.error(`[ASSIGN] Error:`, error);
        res.status(500).json({ message: error.message, stack: error.stack });
    }
};

// @desc    Get person history (all cases for a customer)
// @route   GET /api/cases/person/:customerId
// @access  Private/Admin
const getPersonHistory = async (req, res) => {
    try {
        const { customerId } = req.params;
        const cases = await Case.find({ customerId }).sort({ createdAt: -1 });

        if (!cases || cases.length === 0) {
            return res.status(404).json({ message: 'History not found for this customer' });
        }

        // Aggregate stats
        let totalDebt = 0;
        let totalRepaid = 0;
        let activeCases = 0;
        let closedCases = 0;

        cases.forEach(c => {
            totalDebt += c.amount;
            totalRepaid += (c.totalRepaid || 0);
            if (c.status === 'CLOSED') {
                closedCases++;
            } else {
                activeCases++;
            }
        });

        const repaymentAccuracy = totalDebt === 0 ? 0 : ((totalRepaid / totalDebt) * 100).toFixed(1);

        res.json({
            customerId,
            customerName: cases[0].customerName, // Assume consistent name
            stats: {
                totalDebt,
                totalRepaid,
                activeCases,
                closedCases,
                repaymentAccuracy: Number(repaymentAccuracy)
            },
            cases
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new case
// @route   POST /api/cases
// @access  Private/Admin/Manager
const createCase = async (req, res) => {
    try {
        const { customerName, amount, slaDeadline, priorityScore, customerId } = req.body;

        // Simple ID generation
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const caseId = `CASE-${dateStr}-${randomSuffix}`;

        // Generate customer ID if not provided
        const finalCustomerId = customerId || `CUST-${Math.floor(10000 + Math.random() * 90000)}`;

        const kase = await Case.create({
            caseId,
            customerId: finalCustomerId,
            customerName,
            amount,
            slaDeadline,
            priorityScore: priorityScore || 0.5,
            status: 'OPEN',
            activityLogs: [],
            notes: [],
            paymentHistory: []
        });

        await BREService.logActivity({
            caseId: kase.caseId,
            action: 'CASE_CREATED',
            user: req.user.name,
            userId: req.user._id,
            details: `Case created with amount ${amount}`
        });

        // Trigger Initial AI Scoring
        await AIService.runScoring(kase);

        res.status(201).json(kase);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add a note or specific activity
// @route   POST /api/cases/:id/notes
// @access  Private
const addNote = async (req, res) => {
    try {
        const { content, actionType } = req.body;
        const kase = await Case.findOne({ caseId: req.params.id });

        if (!kase) {
            return res.status(404).json({ message: 'Case not found' });
        }

        const newNote = {
            author: req.user.name,
            content,
            timestamp: new Date()
        };

        kase.notes.push(newNote);
        await kase.save();

        // Dynamic Action Type
        const action = actionType || 'NOTE_ADDED';

        await BREService.logActivity({
            caseId: kase.caseId,
            action: action,
            user: req.user.name,
            userId: req.user._id,
            details: content
        });

        // AUTO-PROGRESS: If case was OPEN, move to IN_PROGRESS
        await BREService.checkAutoProgress(kase.caseId, req.user);

        res.json(kase.notes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Record a payment (Agent)
// @route   POST /api/cases/:id/payment
// @access  Private
const addPayment = async (req, res) => {
    try {
        const { amount, mode, notes, referenceId } = req.body;

        // Use FinancialService to record pending payment
        const kase = await FinancialService.recordPayment(req.params.id, {
            amount,
            method: mode,
            referenceId,
            notes
        }, req.user);

        res.json(kase);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify Payment (Admin)
// @route   POST /api/cases/:id/payment/:paymentId/verify
// @access  Private/Admin
const verifyPayment = async (req, res) => {
    try {
        const { verdict, rejectionReason } = req.body; // APPROVE or REJECT

        const kase = await FinancialService.verifyPayment(
            req.params.id,
            req.params.paymentId,
            req.user,
            verdict,
            rejectionReason
        );

        res.json(kase);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Request Non-Payment / Hardship (Agent)
// @route   POST /api/cases/:id/non-payment
// @access  Private
const requestNonPayment = async (req, res) => {
    try {
        const { reason, description } = req.body;
        const kase = await Case.findOne({ caseId: req.params.id });

        if (!kase) return res.status(404).json({ message: 'Case not found' });

        kase.nonPaymentRequest = {
            status: 'PENDING',
            reason,
            description,
            requestedBy: req.user._id,
            requestedAt: new Date()
        };

        // Potentially set status to something intermediate if needed, but per rules:
        // "System action: Case status updated to non-payment state" -> e.g., NO, wait for approval?
        // Actually, prompt says: "Case status updated to non-payment state" IMMEDIATELY?
        // Re-reading: "System action: Case status updated to non-payment state... Case flagged for FedEx review"
        // Let's set it to 'NOT_ABLE_TO_PAY' immediately or keep it OPEN/IN_PROGRESS pending review?
        // Usually, "Non-Payment Review Queue" implies it's pending.
        // Let's set the REQUEST object, and maybe a temp status or just rely on the request object for the queue.
        // However, the prompt says "Case status updated to non-payment state".
        // Let's interpret this as: The specific REASON becomes the status, or a generic 'NOT_ABLE_TO_PAY'.
        // Let's set it to 'NOT_ABLE_TO_PAY' for now to match the prompt's "Non-payment states".

        // Wait, prompt says: "A case can be marked as one of the following: NOT_ABLE_TO_PAY... These states are distinct".
        // And "Step 1: Agent Marks Non-Payment... System action: Case status updated to non-payment state".
        // OK, so I should set `status = 'NOT_ABLE_TO_PAY'` (or the specific enum if available, but I added generic ones).
        // Let's map reason to status?
        // Statuses I added: 'NOT_ABLE_TO_PAY', 'CUSTOMER_DECLINED', 'ON_HOLD', 'CLOSED_UNRECOVERABLE'.
        // Let's default to 'NOT_ABLE_TO_PAY' unless reason is Refusal -> 'CUSTOMER_DECLINED'.

        if (reason === 'REFUSAL') {
            kase.status = 'CUSTOMER_DECLINED';
        } else {
            kase.status = 'NOT_ABLE_TO_PAY';
        }

        await kase.save();

        await BREService.logActivity({
            caseId: kase.caseId,
            action: 'NON_PAYMENT_REQUESTED',
            user: req.user.name,
            userId: req.user._id,
            details: `Non-Payment Request: ${reason}. ${description}`
        });

        res.json(kase);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Request Settlement (Agent)
// @route   POST /api/cases/:id/settlement
// @access  Private
const requestSettlement = async (req, res) => {
    try {
        const { amount, remarks } = req.body;

        const kase = await FinancialService.requestSettlement(
            req.params.id,
            { amount, remarks },
            req.user
        );

        res.json(kase);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Adjudicate Settlement (Admin)
// @route   POST /api/cases/:id/settlement/adjudicate
// @access  Private/Admin
const adjudicateSettlement = async (req, res) => {
    try {
        const { action, remarks } = req.body; // APPROVE or REJECT

        const kase = await FinancialService.adjudicateSettlement(
            req.params.id,
            action,
            req.user,
            remarks
        );

        res.json(kase);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk import cases (Excel)
// @route   POST /api/cases/import
// @access  Private/Admin
// @desc    Bulk import cases (Excel)
// @route   POST /api/cases/import
// @access  Private/Admin
const importCases = async (req, res) => {
    try {
        const { cases } = req.body;

        if (!cases || !Array.isArray(cases) || cases.length === 0) {
            return res.status(400).json({ message: 'No cases provided for import' });
        }

        // Prepare cases for insertion
        const casesToInsert = cases.map(c => ({
            caseId: c.caseId || c.Case_ID,
            customerId: c.customerId || c.Customer_ID,
            customerName: c.customerName || c.Customer_Name,
            amount: Number(c.amount || c.Outstanding_Amount),
            slaDeadline: new Date(c.slaDeadline || c.SLA_Deadline),
            dueDate: (c.dueDate || c.Due_Date) ? new Date(c.dueDate || c.Due_Date) : undefined,
            priorityScore: c.priorityScore || 0.5,
            status: c.status || c.Status || 'OPEN',
            assignedDCA: null,
            assignedAgentId: null,
            assignedAgent: null,
            paymentHistory: [],
            activityLogs: [],
            notes: [],
            region: (c.region || c.Region || '').trim().toUpperCase() || null
        }));

        const inserted = await Case.insertMany(casesToInsert);

        // Log activity
        if (req.user) {
            await BREService.logActivity({
                caseId: 'BULK_IMPORT',
                action: 'BULK_IMPORT',
                user: req.user.name,
                userId: req.user._id,
                details: `Imported ${inserted.length} cases via Excel.`
            });
        } else {
            await BREService.logActivity({
                caseId: 'BULK_IMPORT',
                action: 'BULK_IMPORT',
                user: 'SYSTEM',
                userId: null,
                details: `Imported ${inserted.length} cases via n8n automation.`
            });
        }

        // CHANGED: Capture assignment details from auto-assignment
        const assignments = await BREService.autoAssignBatch(inserted);

        // CHANGED: Include assignments in response
        res.status(201).json({
            message: `Successfully imported ${inserted.length} cases`,
            count: inserted.length,
            assignments: assignments // ADDED: Return assignment details for n8n
        });

    } catch (error) {
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(__dirname, '../../error.log');
        fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] Import Error: ${error.stack}\n`);

        if (error.code === 11000) {
            return res.status(400).json({ message: 'Duplicate Case ID found in database. Import failed.' });
        }
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Agent Stats (KPIs)
// @route   GET /api/cases/stats/agent
// @access  Private/Agent
const getAgentStats = async (req, res) => {
    try {
        // Ensure user is an agent
        // Although the route might protect it, good to check or use req.user._id
        const stats = await KPIService.getAgentStats(req.user._id);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get counts & lists of pending financial items
// @route   GET /api/cases/financials/pending
// @access  Private/Admin
const getPendingFinancials = async (req, res) => {
    try {
        // 1. Pending Payments
        const casesWithPayments = await Case.find({
            'paymentHistory.status': 'PENDING_VERIFICATION'
        }).select('caseId customerName paymentHistory amount totalRepaid');

        const pendingPayments = [];
        casesWithPayments.forEach(kase => {
            kase.paymentHistory.forEach(p => {
                if (p.status === 'PENDING_VERIFICATION') {
                    pendingPayments.push({
                        caseId: kase.caseId,
                        customerName: kase.customerName,
                        paymentId: p._id,
                        amount: p.amount,
                        method: p.method,
                        date: p.date,
                        referenceId: p.referenceId
                    });
                }
            });
        });

        // 2. Pending Settlements
        const pendingSettlements = await Case.find({
            'settlement.status': 'REQUESTED'
        }).select('caseId customerName settlement amount totalRepaid riskScore');

        res.json({
            payments: pendingPayments,
            settlements: pendingSettlements
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getCases,
    getCaseById,
    createCase,
    updateCaseStatus,
    assignCase,
    addNote,
    addPayment,
    verifyPayment,
    requestSettlement,
    requestNonPayment,
    adjudicateSettlement,
    getPendingFinancials,
    getPersonHistory,
    importCases,
    getAgentStats
};
