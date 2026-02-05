const ReconciliationService = require('../services/ReconciliationService');

// @desc    Generate a monthly report manually
// @route   POST /api/reconciliation/generate
// @access  Private/Admin
const generateReport = async (req, res) => {
    try {
        const { dcaCode, month, year } = req.body;
        const report = await ReconciliationService.generateMonthlyReport(dcaCode, month, year);
        res.json(report);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get a report by ID
// @route   GET /api/reconciliation/:reportId
// @access  Private/Admin/Manager
const getReport = async (req, res) => {
    try {
        const report = await ReconciliationService.getReport(req.params.reportId);
        if (!report) return res.status(404).json({ message: 'Report not found' });

        // RBAC: If manager, ensure it's their DCA
        if (req.user.role.includes('MANAGER') && req.user.dcaId) {
            if (report.dcaId._id.toString() !== req.user.dcaId.toString()) {
                return res.status(403).json({ message: 'Access Denied' });
            }
        }

        res.json(report);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    generateReport,
    getReport
};
