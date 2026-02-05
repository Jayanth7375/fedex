const ActivityLog = require('../models/ActivityLog');

// @desc    Get Audit Logs
// @route   GET /api/audit
// @access  Private/Admin
const getAuditLogs = async (req, res) => {
    try {
        const { action, user, startDate, endDate } = req.query;
        let query = {};

        if (action && action !== 'ALL') {
            query.action = action;
        }

        if (user && user !== 'ALL') {
            query.user = user; // Partial match or exact match depending on reqs. Let's do exact for now.
        }

        if (startDate && endDate) {
            query.timestamp = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const logs = await ActivityLog.find(query).sort({ timestamp: -1 }).limit(100);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAuditLogs
};
