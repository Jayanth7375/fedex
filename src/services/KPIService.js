const Case = require('../models/Case');
const mongoose = require('mongoose');

class KPIService {
    // === ADMIN (GLOBAL) ===
    static async getGlobalStats() {
        const totalCases = await Case.countDocuments();
        const activeCases = await Case.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS', 'AT_RISK'] } });
        const closedCases = await Case.countDocuments({ status: 'CLOSED' });
        const slaBreached = await Case.countDocuments({ status: 'SLA_BREACHED' });

        // Financials (Aggregation for speed)
        const financialStats = await Case.aggregate([
            {
                $group: {
                    _id: null,
                    totalDebt: { $sum: "$amount" },
                    totalRepaid: { $sum: "$totalRepaid" }
                }
            }
        ]);

        const totalDebt = financialStats[0]?.totalDebt || 0;
        const totalRepaid = financialStats[0]?.totalRepaid || 0;
        const recoveryRate = totalDebt === 0 ? 0 : ((totalRepaid / totalDebt) * 100).toFixed(1);

        return {
            totalCases,
            activeCases,
            closedCases,
            slaBreached,
            totalDebt,
            totalRepaid,
            recoveryRate: Number(recoveryRate)
        };
    }

    // === DCA MANAGER (SCOPED) ===
    static async getDCAStats(dcaCode) {
        if (!dcaCode) throw new Error('DCA Code required');

        const totalCases = await Case.countDocuments({ assignedDCA: dcaCode });
        const activeCases = await Case.countDocuments({ assignedDCA: dcaCode, status: { $in: ['OPEN', 'IN_PROGRESS', 'AT_RISK'] } });
        const closedCases = await Case.countDocuments({ assignedDCA: dcaCode, status: 'CLOSED' });
        const slaBreached = await Case.countDocuments({ assignedDCA: dcaCode, status: 'SLA_BREACHED' });

        // Agent Performance for this DCA
        const agentPerformance = await Case.aggregate([
            { $match: { assignedDCA: dcaCode, assignedAgent: { $ne: null } } },
            {
                $group: {
                    _id: "$assignedAgent",
                    totalAssigned: { $sum: 1 },
                    closed: { $sum: { $cond: [{ $eq: ["$status", "CLOSED"] }, 1, 0] } },
                    totalRepaid: { $sum: "$totalRepaid" },
                    totalDebt: { $sum: "$amount" }
                }
            },
            {
                $project: {
                    agentName: "$_id",
                    totalAssigned: 1,
                    closed: 1,
                    recoveryRate: {
                        $cond: [
                            { $eq: ["$totalDebt", 0] },
                            0,
                            { $multiply: [{ $divide: ["$totalRepaid", "$totalDebt"] }, 100] }
                        ]
                    }
                }
            }
        ]);

        // Global DCA Recovery Rate
        const dcaFinancials = await Case.aggregate([
            { $match: { assignedDCA: dcaCode } },
            {
                $group: {
                    _id: null,
                    totalDebt: { $sum: "$amount" },
                    totalRepaid: { $sum: "$totalRepaid" }
                }
            }
        ]);

        const totalDebt = dcaFinancials[0]?.totalDebt || 0;
        const totalRepaid = dcaFinancials[0]?.totalRepaid || 0;
        const recoveryRate = totalDebt === 0 ? 0 : ((totalRepaid / totalDebt) * 100).toFixed(1);

        // Recovery Trend (Last 6 Months) using PaymentHistory
        // We need to unwind cases and then paymentHistory to aggregate by date
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1); // Start of month

        const trends = await Case.aggregate([
            { $match: { assignedDCA: dcaCode } },
            { $unwind: "$paymentHistory" },
            {
                $match: {
                    "paymentHistory.date": { $gte: sixMonthsAgo },
                    "paymentHistory.status": "VERIFIED" // Only count verified payments
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: "$paymentHistory.date" },
                        year: { $year: "$paymentHistory.date" }
                    },
                    monthlyTotal: { $sum: "$paymentHistory.amount" }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        // Format trends for frontend (Chart expects: { name: 'Jan', value: 1000 })
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const recoveryTrend = [];

        // Generate last 6 months skeleton to ensure we have data even if 0
        for (let i = 0; i < 6; i++) {
            const d = new Date();
            d.setDate(1); // Avoid month rollover issues
            d.setMonth(d.getMonth() - (5 - i));
            const monthIdx = d.getMonth();
            const year = d.getFullYear();

            const found = trends.find(t => t._id.month === (monthIdx + 1) && t._id.year === year);

            recoveryTrend.push({
                name: monthNames[monthIdx],
                value: found ? found.monthlyTotal : 0
            });
        }

        return {
            totalCases,
            pendingCases: activeCases, // Aliased for frontend
            activeCases,
            closedCases,
            slaBreached,
            recoveryRate: Number(recoveryRate),
            agentPerformance,
            recoveryTrend
        };
    }

    // === AGENT (SCOPED) ===
    static async getAgentStats(agentId) {
        if (!agentId) throw new Error('Agent ID required');

        // Ensure agentId is ObjectId if passing ObjectId
        // If stored as string in schema, keep as string. Schema says ObjectId ref.

        const totalCases = await Case.countDocuments({ assignedAgentId: agentId });
        const activeCases = await Case.countDocuments({ assignedAgentId: agentId, status: { $in: ['OPEN', 'IN_PROGRESS', 'AT_RISK'] } });
        const closedCases = await Case.countDocuments({ assignedAgentId: agentId, status: 'CLOSED' });
        const atRisk = await Case.countDocuments({ assignedAgentId: agentId, status: 'AT_RISK' });
        const slaBreached = await Case.countDocuments({ assignedAgentId: agentId, status: 'SLA_BREACHED' });

        return {
            totalCases,
            activeCases,
            closedCases,
            atRisk,
            slaBreached
        };
    }
}

module.exports = KPIService;
