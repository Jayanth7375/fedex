const Case = require('../models/Case');
const ActivityLog = require('../models/ActivityLog');
const AIService = require('./AIService');

class BREService {
    /**
     * Centralized Activity Logging
     */
    static async logActivity({ caseId, action, user, userId, details }) {
        try {
            await ActivityLog.create({
                caseId,
                action,
                user, // User Name
                userId,
                details,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('BRE Activity Log Error:', error);
        }
    }

    /**
     * Checks and updates case status based on lifecycle rules
     * Rule: OPEN -> IN_PROGRESS on first significant agent action (Note/Update)
     */
    static async checkAutoProgress(caseId, user) {
        try {
            const kase = await Case.findOne({ caseId });
            if (!kase) return;

            // Trigger AI Re-scoring on activity
            await AIService.runScoring(kase);

            // Rule: If status is OPEN and an action is performed, move to IN_PROGRESS
            // Exception: If the action is just assignment (handled separately) or if specifically setting to something else
            if (kase.status === 'OPEN') {
                kase.status = 'IN_PROGRESS';
                await kase.save();

                await this.logActivity({
                    caseId: kase.caseId,
                    action: 'AUTO_STATUS_CHANGE',
                    user: 'SYSTEM (BRE)',
                    userId: user._id,
                    details: 'Case automatically moved to IN_PROGRESS due to agent activity.'
                });

                return kase;
            }
            return kase;
        } catch (error) {
            console.error('BRE Auto-Progress Error:', error);
        }
    }

    /**
     * Evaluates SLA status for a single case
     * Rule: 
     * - Deadine passed -> BREACHED
     * - < 24h remaining -> AT_RISK
     */
    static async evaluateSLA(kase) {
        if (['CLOSED', 'NOT_ABLE_TO_PAY', 'CUSTOMER_DECLINED', 'ON_HOLD', 'CLOSED_UNRECOVERABLE'].includes(kase.status)) return; // Don't check closed or non-payment cases

        const now = new Date();
        const deadline = new Date(kase.slaDeadline);
        const timeDiff = deadline - now;
        const hoursRemaining = timeDiff / (1000 * 60 * 60);

        let newStatus = null;

        if (now > deadline && kase.status !== 'SLA_BREACHED') {
            newStatus = 'SLA_BREACHED';
        } else if (hoursRemaining <= 24 && hoursRemaining > 0 && kase.status !== 'AT_RISK' && kase.status !== 'SLA_BREACHED') {
            newStatus = 'AT_RISK';
        }

        if (newStatus && kase.status !== newStatus) {
            const oldStatus = kase.status;
            kase.status = newStatus;
            await kase.save();

            await this.logActivity({
                caseId: kase.caseId,
                action: 'SLA_UPDATE',
                user: 'SYSTEM (BRE)',
                userId: null,
                details: `SLA Status changed from ${oldStatus} to ${newStatus}`
            });
            console.log(`[BRE] Case ${kase.caseId} moved to ${newStatus}`);
        }
    }

    /**
     * Batch job to refresh SLAs for all active cases
     */
    static async refreshAllSLAs() {
        console.log('[BRE] Starting SLA Refresh Job...');
        try {
            const activeCases = await Case.find({
                status: { $nin: ['CLOSED', 'SLA_BREACHED'] }
            });

            for (const kase of activeCases) {
                await this.evaluateSLA(kase);
                // Also refresh AI Score periodically (e.g. as deadline approaches, score increases)
                await AIService.runScoring(kase);
            }
            console.log(`[BRE] Processed SLA check and AI Scoring for ${activeCases.length} cases.`);
        } catch (error) {
            console.error('BRE SLA Refresh Error:', error);
        }
    }
    /**
     * Applies rules based on Non-Payment Decision
     */
    static async applyNonPaymentRule(kase, decision) {
        let newStatus = kase.status;
        let logAction = 'NON_PAYMENT_DECISION';

        switch (decision) {
            case 'HOLD':
                newStatus = 'ON_HOLD';
                logAction = 'CASE_ON_HOLD';
                break;
            case 'CLOSE_UNRECOVERABLE':
                newStatus = 'CLOSED_UNRECOVERABLE';
                logAction = 'CASE_CLOSED_UNRECOVERABLE';
                break;
            case 'EXTEND_SLA':
                // Logic to extend SLA by e.g. 7 days
                const currentDeadline = new Date(kase.slaDeadline);
                currentDeadline.setDate(currentDeadline.getDate() + 7);
                kase.slaDeadline = currentDeadline;
                logAction = 'SLA_EXTENDED';
                // Status remains active
                break;
            case 'REJECT':
                // Reset status to IN_PROGRESS so agent can continue
                newStatus = 'IN_PROGRESS';
                logAction = 'NON_PAYMENT_REJECTED';
                break;
        }

        if (newStatus !== kase.status) {
            kase.status = newStatus;
        }

        await kase.save();

        await this.logActivity({
            caseId: kase.caseId,
            action: logAction,
            user: 'SYSTEM (BRE)',
            userId: null,
            details: `Admin decision applied: ${decision}. Status: ${newStatus}`
        });

        return kase;
    }

    /**
     * Auto-assigns a batch of cases to the best DCA and Agent
     * MODIFIED: Now returns array of assignments with agent details
     */
    static async autoAssignBatch(cases) {
        console.log(`[BRE] Starting Auto-Assignment for ${cases.length} cases.`);
        const DCA = require('../models/DCA');
        const activeDCAs = await DCA.find({ status: 'ACTIVE' });

        if (activeDCAs.length === 0) {
            console.log('[BRE] No active DCAs found. Skipping assignment.');
            return []; // CHANGED: Return empty array instead of undefined
        }

        const assignments = []; // ADDED: Array to collect assignment details

        for (const kase of cases) {
            // Skip if already assigned
            if (kase.assignedDCA) continue;

            const bestDCA = this.calculateBestDCA(kase, activeDCAs);

            if (bestDCA) {
                kase.assignedDCA = bestDCA.dca.code;

                // Update DCA stats (optimistic)
                bestDCA.dca.totalCasesAssigned = (bestDCA.dca.totalCasesAssigned || 0) + 1;
                await bestDCA.dca.save();

                await kase.save();

                await this.logActivity({
                    caseId: kase.caseId,
                    action: 'AUTO_ASSIGN_DCA',
                    user: 'SYSTEM (BRE)',
                    userId: null,
                    details: `Auto-assigned to ${bestDCA.dca.name} (Score: ${bestDCA.score}). match: ${bestDCA.details}`
                });

                // CHANGED: Capture agent assignment details
                const agentDetails = await this.assignBestAgent(kase, bestDCA.dca.code);

                // ADDED: If agent was assigned, add to assignments array
                if (agentDetails) {
                    assignments.push({
                        caseId: kase.caseId,
                        customerName: kase.customerName,
                        amount: kase.amount,
                        region: kase.region,
                        dcaCode: bestDCA.dca.code,
                        dcaName: bestDCA.dca.name,
                        agentName: agentDetails.agentName,
                        agentEmail: agentDetails.agentEmail,
                        agentId: agentDetails.agentId
                    });
                }
            }
        }
        console.log(`[BRE] Auto-assigned ${assignments.length} cases with agent details.`);
        
        return assignments; // CHANGED: Return assignments array
    }

    /**
     * Finds Best Agent within a DCA based on Region & Load
     * MODIFIED: Now returns agent details object
     */
    static async assignBestAgent(kase, dcaCode) {
        try {
            const User = require('../models/User');

            // 1. Find Candidates
            const agents = await User.find({
                dcaId: dcaCode,
                status: 'ACTIVE',
                $or: [
                    { role: 'AGENT' },
                    { role: 'DCA_AGENT' }
                ],
                supportedRegions: kase.region
            });

            if (agents.length === 0) {
                console.log(`[BRE] No matching agents in DCA ${dcaCode} for region ${kase.region}`);
                return null; // CHANGED: Return null instead of undefined
            }

            // 2. "AI" Scoring (Load Balancing + Random Tie-Breaker)
            let bestAgent = null;
            let minLoad = Infinity;

            for (const agent of agents) {
                const load = await Case.countDocuments({
                    assignedAgentId: agent._id,
                    status: { $in: ['OPEN', 'IN_PROGRESS', 'AT_RISK'] }
                });

                if (load < minLoad) {
                    minLoad = load;
                    bestAgent = agent;
                }
            }

            // 3. Assign
            if (bestAgent) {
                kase.assignedAgentId = bestAgent._id;
                kase.assignedAgent = bestAgent.name;
                kase.status = 'IN_PROGRESS';

                await kase.save();

                await this.logActivity({
                    caseId: kase.caseId,
                    action: 'AUTO_ASSIGN_AGENT',
                    user: 'SYSTEM (AI)',
                    userId: null,
                    details: `AI assigned to agent ${bestAgent.name} (${bestAgent.email}) - Load: ${minLoad}, Region: ${kase.region}`
                });
                
                console.log(`[BRE] Assigned Case ${kase.caseId} to Agent ${bestAgent.name} (${bestAgent.email})`);

                // CHANGED: Return agent details
                return {
                    agentName: bestAgent.name,
                    agentEmail: bestAgent.email,
                    agentId: bestAgent._id.toString(),
                    currentLoad: minLoad
                };
            }

            return null; // ADDED: Return null if no agent found

        } catch (error) {
            console.error(`[BRE] Agent Assignment Error: ${error.message}`);
            return null; // CHANGED: Return null on error
        }
    }

    /**
     * Calculates Suitability Score for DCAs
     */
    static calculateBestDCA(kase, dcas) {
        let bestDCA = null;
        let highestScore = -Infinity;

        for (const dca of dcas) {
            let score = 0;
            const reasons = [];

            console.log(`[BRE] Evaluating DCA: ${dca.name}, Region: ${dca.region}, Supported: ${dca.supportedRegions}, Case Region: ${kase.region}`);

            // 1. Region Match (STRICT - per Master Spec)
            let supportsRegion = dca.supportedRegions && dca.supportedRegions.includes(kase.region);

            // Fallback: If supportedRegions is empty, check legacy 'region' field
            if (!supportsRegion && (!dca.supportedRegions || dca.supportedRegions.length === 0)) {
                supportsRegion = (dca.region === kase.region);
            }

            if (!supportsRegion && dca.region !== 'National') {
                continue; // Skip this DCA entirely
            }

            if (supportsRegion) {
                score += 50;
                reasons.push('Region Match');
            } else {
                score += 10;
                reasons.push('National/Legacy Coverage');
            }

            // 2. Performance (+ Score * 20)
            const perf = dca.performanceScore || 0;
            score += perf * 20;

            // 3. Load Balancing (-1 per 50 cases)
            const loadPenalty = Math.floor((dca.totalCasesAssigned || 0) / 50);
            score -= loadPenalty;

            if (score > highestScore) {
                highestScore = score;
                bestDCA = { dca, score, details: reasons.join(', ') };
            }
        }

        if (bestDCA) {
            console.log(`[BRE] Best DCA Found: ${bestDCA.dca.name} with Score: ${bestDCA.score}`);
        } else {
            console.log(`[BRE] No suitable DCA found for Case Region: ${kase.region}`);
        }

        return bestDCA;
    }
}

module.exports = BREService;