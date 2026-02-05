const Case = require('../models/Case');
const DCA = require('../models/DCA');
const User = require('../models/User');
const KPIService = require('../services/KPIService');

// @desc    Get Admin KPIs
// @route   GET /api/admin/kpis
// @access  Private/Admin
const getKPIs = async (req, res) => {
    try {
        const stats = await KPIService.getGlobalStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Dashboard Analytics (Charts)
// @route   GET /api/admin/analytics
// @access  Private/Admin
const getDashboardAnalytics = async (req, res) => {
    try {
        // 1. DCA Performance (Recovery Rate by DCA)
        const dcaPerformance = await Case.aggregate([
            {
                $group: {
                    _id: "$assignedDCA",
                    totalAmount: { $sum: "$amount" },
                    totalRepaid: { $sum: "$totalRepaid" },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    name: "$_id",
                    recoveryRate: {
                        $cond: [
                            { $eq: ["$totalAmount", 0] },
                            0,
                            { $multiply: [{ $divide: ["$totalRepaid", "$totalAmount"] }, 100] }
                        ]
                    },
                    totalAmount: 1,
                    totalRepaid: 1,
                    count: 1
                }
            }
        ]);

        // 2. Recovery Trend (Mocking this based on created date for now as we lack transaction table for every repayment in this simple exploration)
        // Ideally we would aggregate paymentHistory array.
        // Let's try to aggregate paymentHistory if it exists in schema.

        const recoveryTrend = await Case.aggregate([
            { $unwind: { path: "$paymentHistory", preserveNullAndEmptyArrays: false } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$paymentHistory.date" } },
                    amount: { $sum: "$paymentHistory.amount" }
                }
            },
            { $sort: { "_id": 1 } },
            { $limit: 30 } // Last 30 entries
        ]);

        res.json({
            dcaPerformance,
            recoveryTrend
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// ... (Existing exports: getKPIs, getDashboardAnalytics) ... Keep them

// @desc    Register a new DCA
// @route   POST /api/admin/dca
// @access  Private/Admin
const createDCA = async (req, res) => {
    try {
        let { name, code, contactEmail } = req.body;

        // Auto-generate Code
        if (!code) {
            // Simple strategy: DCA + first 3 letters of name + random
            const prefix = name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
            code = `DCA-${prefix}`;
        }

        const dcaExists = await DCA.findOne({ code });
        if (dcaExists) {
            return res.status(400).json({ message: `DCA with code ${code} already exists` });
        }

        const dca = await DCA.create({
            name,
            code,
            contactEmail,
            status: 'ACTIVE'
        });

        res.status(201).json(dca);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get All DCAs
// @route   GET /api/admin/dca
// @access  Private/Admin
const getAllDCAs = async (req, res) => {
    try {
        const dcas = await DCA.find();
        res.json(dcas);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get DCA Details with Stats
// @route   GET /api/admin/dca/:id
// @access  Private/Admin
const getDCADetails = async (req, res) => {
    try {
        const dca = await DCA.findById(req.params.id);
        if (!dca) return res.status(404).json({ message: 'DCA not found' });

        // Get Case Stats
        const cases = await Case.find({ assignedDCA: dca.code });

        // Simple aggregate
        const stats = {
            totalAssigned: cases.length,
            active: cases.filter(c => ['OPEN', 'IN_PROGRESS'].includes(c.status)).length,
            closed: cases.filter(c => c.status === 'CLOSED').length,
            breached: cases.filter(c => c.status === 'SLA_BREACHED').length,
            totalDebt: cases.reduce((sum, c) => sum + c.amount, 0),
            totalRepaid: cases.reduce((sum, c) => sum + (c.totalRepaid || 0), 0)
        };

        res.json({ dca, stats, cases: cases.slice(0, 50) }); // Limit cases for detail view
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update DCA Status
// @route   PUT /api/admin/dca/:id/status
// @access  Private/Admin
const updateDCAStatus = async (req, res) => {
    try {
        const { status } = req.body; // ACTIVE / INACTIVE
        const dca = await DCA.findById(req.params.id);
        if (!dca) return res.status(404).json({ message: 'DCA not found' });

        dca.status = status;
        await dca.save();
        res.json(dca);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Assign Case to DCA
// @route   PUT /api/admin/cases/assign
// @access  Private/Admin
const assignCaseToDCA = async (req, res) => {
    try {
        const { caseIds, dcaCode } = req.body; // Array of IDs, DCA Code

        const dca = await DCA.findOne({ code: dcaCode });
        if (!dca) return res.status(404).json({ message: 'Target DCA not found' });

        if (dca.status !== 'ACTIVE') {
            return res.status(400).json({ message: 'Cannot assign to Inactive DCA' });
        }

        // Update Cases
        await Case.updateMany(
            { caseId: { $in: caseIds } },
            {
                $set: {
                    assignedDCA: dca.code,
                    assignedAgent: null, // Reset agent assignments
                    assignedAgentId: null
                }
            }
        );

        // Update stats
        const count = await Case.countDocuments({ assignedDCA: dca.code });
        dca.totalCasesAssigned = count;
        await dca.save();

        res.json({ message: `Assigned ${caseIds.length} cases to ${dca.name}` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Managers for a DCA
// @route   GET /api/admin/dca/:id/managers
// @access  Private/Admin
const getDCAManagers = async (req, res) => {
    try {
        const dca = await DCA.findById(req.params.id);
        if (!dca) return res.status(404).json({ message: 'DCA not found' });

        const managers = await User.find({ dcaId: dca.code, role: 'DCA_MANAGER' }).select('-password');
        res.json(managers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create DCA Manager
// @route   POST /api/admin/dca/:id/managers
// @access  Private/Admin
const createDCAManager = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const dca = await DCA.findById(req.params.id);
        if (!dca) return res.status(404).json({ message: 'DCA not found' });

        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: 'User already exists' });

        const user = await User.create({
            name,
            email,
            password,
            role: 'DCA_MANAGER',
            dcaId: dca.code,
            status: 'ACTIVE'
        });

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            dcaId: user.dcaId,
            status: user.status
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Manager Status
// @route   PUT /api/admin/managers/:id/status
// @access  Private/Admin
const updateManagerStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.role !== 'DCA_MANAGER') return res.status(400).json({ message: 'Can only update DCA Managers' });

        user.status = status;
        await user.save();

        res.json({
            _id: user._id,
            status: user.status
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update DCA Details
// @route   PUT /api/admin/dca/:id
// @access  Private/Admin
const updateDCA = async (req, res) => {
    try {
        const { name, contactEmail, supportedRegions } = req.body;
        const dca = await DCA.findById(req.params.id);

        if (!dca) return res.status(404).json({ message: 'DCA not found' });

        if (name) dca.name = name;
        if (contactEmail) dca.contactEmail = contactEmail;
        if (supportedRegions) dca.supportedRegions = supportedRegions;

        await dca.save();
        res.json(dca);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Review Non-Payment Request (FedEx Admin)
// @route   POST /api/admin/cases/:id/non-payment/review
// @access  Private/Admin
const reviewNonPayment = async (req, res) => {
    try {
        const { caseId } = req.params;
        const { decision, comments } = req.body; // decision: EXTEND_SLA, HOLD, CLOSE_UNRECOVERABLE, REJECT
        const adminUser = req.user;

        // Ensure BREService is required at top, but for now require inside to avoid hoisting issues or modify top
        const BREService = require('../services/BREService');

        const kase = await Case.findOne({ caseId });
        if (!kase) return res.status(404).json({ message: 'Case not found' });

        if (!kase.nonPaymentRequest || kase.nonPaymentRequest.status === 'NONE') {
            return res.status(400).json({ message: 'No active non-payment request' });
        }

        // Update Request Object
        kase.nonPaymentRequest.status = decision === 'REJECT' ? 'REJECTED' : 'APPROVED';
        kase.nonPaymentRequest.adminDecision = decision;
        kase.nonPaymentRequest.adminComments = comments;
        kase.nonPaymentRequest.reviewedBy = adminUser._id;
        kase.nonPaymentRequest.reviewedAt = new Date();

        // Apply BRE Rules (Status Change / SLA Extension)
        await BREService.applyNonPaymentRule(kase, decision);

        res.json(kase);
    } catch (error) {
        console.error("Non-Payment Review Error:", error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getKPIs,
    getDashboardAnalytics,
    createDCA,
    getAllDCAs,
    getDCADetails,
    updateDCAStatus,
    assignCaseToDCA,
    getDCAManagers,
    createDCAManager,
    updateManagerStatus,
    updateDCA,
    reviewNonPayment
};


