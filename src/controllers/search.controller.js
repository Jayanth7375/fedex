const Case = require('../models/Case');

// @desc    Global Search
// @route   GET /api/search?q=...
// @access  Private
const searchGlobal = async (req, res) => {
    try {
        const keyword = req.query.q;
        if (!keyword) {
            return res.json([]);
        }

        const regex = new RegExp(keyword, 'i');

        let query = {
            $or: [
                { caseId: regex },
                { customerName: regex },
                { customerId: regex }
            ]
        };

        // Apply RBAC filters to search results
        if (req.user.role === 'MANAGER' && req.user.dcaId) {
            query.assignedDCA = req.user.dcaId;
        } else if (req.user.role === 'AGENT') {
            query.assignedAgentId = req.user._id;
        }

        const results = await Case.find(query)
            .select('caseId customerName status amount priorityScore assignedAgent')
            .limit(20);

        res.json(results);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    searchGlobal
};
