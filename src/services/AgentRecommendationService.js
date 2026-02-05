const Case = require('../models/Case');
const User = require('../models/User');

class AgentRecommendationService {
    /**
     * Calculate Suitability Score for all agents in the DCA
     * @param {String} caseId 
     * @param {String} dcaId (optional, if restricted to DCA)
     */
    async getRecommendations(caseId, dcaId) {
        const caseItem = await Case.findOne({ caseId });
        if (!caseItem) throw new Error('Case not found');

        // Filter agents by Role AND DCA ID to prevent cross-agency leakage
        const query = { role: 'AGENT', status: 'ACTIVE' };
        if (dcaId) {
            query.dcaId = dcaId;
        }

        const agents = await User.find(query);

        const recommendations = [];

        for (const agent of agents) {
            const score = await this.calculateAgentScore(agent, caseItem);
            recommendations.push({
                agentId: agent._id,
                agentName: agent.name,
                score: score.totalScore,
                details: score.details,
                region: agent.region
            });
        }

        // Sort by Score Descending
        return recommendations.sort((a, b) => b.score - a.score);
    }

    async calculateAgentScore(agent, caseItem) {
        // 1. Fetch Agent Performance Data
        const closedCases = await Case.countDocuments({
            assignedAgentId: agent._id,
            status: 'CLOSED'
        });

        const totalCases = await Case.countDocuments({
            assignedAgentId: agent._id
        });

        const payments = await Case.aggregate([
            { $match: { assignedAgentId: agent._id, status: 'CLOSED' } },
            { $group: { _id: null, total: { $sum: "$totalRepaid" } } }
        ]);
        const totalRecovered = payments[0]?.total || 0;

        const slaBreaches = await Case.countDocuments({
            assignedAgentId: agent._id,
            status: 'SLA_BREACHED'
        });

        // 2. Calculate Metrics
        const successRate = totalCases > 0 ? (closedCases / totalCases) : 0; // 0-1
        const avgRecovery = closedCases > 0 ? (totalRecovered / closedCases) : 0;

        // Normalize Recovery (Assuming max expected is roughly case amount or arbitrary ceiling like 10k)
        // For scoring, we compare against the *current case amount* or a global max. 
        // Let's use current case amount as a baseline for "capability". 
        // If they usually recover 5000 and this case is 5000, that's good.
        // Capping at 1.0 for simplicity.
        const recoveryScore = Math.min(avgRecovery / Math.max(caseItem.amount, 1000), 1.5);

        const regionMatch = (agent.region === caseItem.region) ? 1 : 0;
        const slaPenalty = slaBreaches * 0.1; // 10% penalty per breach (harsh)

        // 3. Apply Weights (0-100 Scale)
        // Success Rate (40%) + Recovery (30%) + Region (20%) - SLA Penalty (10% weight equivalent, derived from logic)

        let rawScore = (successRate * 40) + (recoveryScore * 30) + (regionMatch * 20) - (slaPenalty * 10);

        // Clamp 0-100
        rawScore = Math.max(0, Math.min(rawScore, 100));

        return {
            totalScore: Math.round(rawScore),
            details: {
                successRate: (successRate * 100).toFixed(1) + '%',
                avgRecovery: '$' + Math.round(avgRecovery),
                regionMatch: !!regionMatch,
                slaBreaches
            }
        };
    }
}

module.exports = new AgentRecommendationService();
