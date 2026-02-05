const User = require('../models/User');
const Case = require('../models/Case');
const agentRecommendationService = require('../services/AgentRecommendationService');
const bcrypt = require('bcryptjs');
const KPIService = require('../services/KPIService');

// @desc    Get AI-based Agent Recommendations
// @route   GET /api/manager/agents/recommendations/:caseId
// @access  Manager
const getAgentRecommendations = async (req, res) => {
    try {
        const { caseId } = req.params;
        const dcaId = req.user.dcaId; // Extracted from authenticated user token

        const recommendations = await agentRecommendationService.getRecommendations(caseId, dcaId);
        res.json(recommendations);
    } catch (error) {
        console.error("Recommendation Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new agent for the DCA
// @route   POST /api/manager/agents
// @access  Private/Manager
const createAgent = async (req, res) => {
    try {
        const { name, email, password, supportedRegions } = req.body;

        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Set primary region to first supported region or default 'CENTRAL'
        const primaryRegion = (supportedRegions && supportedRegions.length > 0) ? supportedRegions[0] : 'CENTRAL';

        const agent = await User.create({
            name,
            email,
            password,
            role: 'AGENT',
            dcaId: req.user.dcaId, // Link to Manager's DCA
            supportedRegions: supportedRegions || ['CENTRAL'],
            region: primaryRegion
        });

        if (agent) {
            res.status(201).json({
                _id: agent._id,
                name: agent.name,
                email: agent.email,
                role: agent.role,
                dcaId: agent.dcaId,
                supportedRegions: agent.supportedRegions
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all agents for the DCA
// @route   GET /api/manager/agents
// @access  Private/Manager
const getAgents = async (req, res) => {
    try {
        const agents = await User.find({
            role: 'AGENT',
            dcaId: req.user.dcaId
        }).select('-password');

        // Enhance with case counts
        const agentsWithStats = await Promise.all(agents.map(async (agent) => {
            const caseCount = await Case.countDocuments({ assignedAgentId: agent._id, status: { $ne: 'CLOSED' } });
            return {
                ...agent.toObject(),
                activeCases: caseCount
            };
        }));

        res.json(agentsWithStats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get DCA Performance Stats
// @route   GET /api/manager/stats
// @access  Private/Manager
const getDCAStats = async (req, res) => {
    try {
        const dcaId = req.user.dcaId;
        const stats = await KPIService.getDCAStats(dcaId);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



// @desc    Update Agent (Edit details or toggle status)
// @route   PUT /api/manager/agents/:id
// @access  Private/Manager
const updateAgent = async (req, res) => {
    try {
        const { name, email, status, password, supportedRegions } = req.body;
        const agent = await User.findById(req.params.id);

        if (!agent) {
            return res.status(404).json({ message: 'Agent not found' });
        }

        // Security check: Ensure agent belongs to this Manager's DCA
        if (agent.dcaId !== req.user.dcaId) {
            return res.status(403).json({ message: 'Not authorized to update this agent' });
        }

        agent.name = name || agent.name;
        agent.email = email || agent.email;
        if (status) agent.status = status;
        if (password) agent.password = password; // Pre-save hook will hash it
        if (supportedRegions) {
            agent.supportedRegions = supportedRegions;
            // Update primary region too if needed
            if (supportedRegions.length > 0) {
                agent.region = supportedRegions[0];
            }
        }

        const updatedAgent = await agent.save();

        res.json({
            _id: updatedAgent._id,
            name: updatedAgent.name,
            email: updatedAgent.email,
            role: updatedAgent.role,
            status: updatedAgent.status,
            dcaId: updatedAgent.dcaId,
            supportedRegions: updatedAgent.supportedRegions
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Historical Performance Data (Mocked for now as we don't have historical table)
// @route   GET /api/manager/performance
// @access  Private/Manager
const getPerformanceHistory = async (req, res) => {
    try {
        // In a real app, we would query a 'DailyStats' collection.
        // For now, we generate realistic mock data based on current month's totals.

        const dcaId = req.user.dcaId;
        const totalRecovered = await Case.aggregate([
            { $match: { assignedDCA: dcaId, status: 'CLOSED' } },
            { $group: { _id: null, total: { $sum: '$totalRepaid' } } }
        ]);

        const currentRecovery = totalRecovered[0]?.total || 0;

        // Generate last 6 months data
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthName = date.toLocaleString('default', { month: 'short' });

            // Randomize slightly around a base value for realism
            const baseAmount = currentRecovery / 6;
            const randomFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2

            months.push({
                name: monthName,
                recovered: Math.round(baseAmount * randomFactor)
            });
        }

        res.json(months);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createAgent,
    getAgents,
    getDCAStats,
    updateAgent,
    getPerformanceHistory,
    getAgentRecommendations
};
