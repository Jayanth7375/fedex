const DCA = require('../models/DCA');
const User = require('../models/User'); // Required for Agent Assignment
const BREService = require('./BREService'); // For logging

class DCAAssignmentService {

    /**
     * Assigns a DCA (and optionally an Agent) to a case based on rules.
     * @param {Object} kase - The Case mongoose document
     * @returns {Object|null} - The assigned DCA object or null
     */
    static async assignDCA(kase) {
        try {
            console.log(`[DCAAssignment] Attempting assignment for Case ${kase.caseId} (Region: ${kase.region})`);

            if (kase.assignedDCA) {
                console.log(`[DCAAssignment] Case already assigned to ${kase.assignedDCA}`);
                return null;
            }

            // 1. Find Matching DCAs by Region
            const matchingDCAs = await DCA.find({
                status: 'ACTIVE',
                $or: [
                    { supportedRegions: kase.region },  // Modern array check
                    { region: kase.region }             // Legacy string check
                ]
            });

            if (matchingDCAs.length === 0) {
                console.log(`[DCAAssignment] No active DCA found for region ${kase.region}`);
                await BREService.logActivity({
                    caseId: kase.caseId,
                    action: 'ASSIGNMENT_FAILED',
                    user: 'SYSTEM',
                    userId: null,
                    details: `No DCA found for region ${kase.region}`
                });
                return null;
            }

            // 2. Select Best DCA (Simple Random/First for now, can be Score-based)
            // Sort by performanceScore desc to pick best
            matchingDCAs.sort((a, b) => b.performanceScore - a.performanceScore);
            const selectedDCA = matchingDCAs[0];

            console.log(`[DCAAssignment] Selected DCA: ${selectedDCA.name} (${selectedDCA.code})`);

            // 3. Assign to Case
            kase.assignedDCA = selectedDCA.code;

            // 4. (NEW) Attempt Auto-Assignment of Agent
            await this.autoAssignAgent(kase, selectedDCA.code);

            // 5. Update Status
            // If Agent is assigned, move to IN_PROGRESS? Or just stay OPEN assigned?
            // Usually 'IN_PROGRESS' implies active working. Let's set to IN_PROGRESS if DCA is assigned.
            kase.status = 'IN_PROGRESS';

            await kase.save();

            // 6. Log Activity
            await BREService.logActivity({
                caseId: kase.caseId,
                action: 'AUTO_ASSIGNED',
                user: 'SYSTEM',
                userId: null,
                details: `Auto-assigned to DCA: ${selectedDCA.name}${kase.assignedAgent ? ` and Agent: ${kase.assignedAgent}` : ''}`
            });

            return selectedDCA;

        } catch (err) {
            console.error('[DCAAssignment] Error:', err);
            return null;
        }
    }

    /**
     * Finds an available agent in the DCA and assigns them.
     */
    static async autoAssignAgent(kase, dcaId) {
        try {
            // Find agents belonging to this DCA
            const agents = await User.find({
                role: 'AGENT',
                dcaId: dcaId,
                status: 'ACTIVE'
            });

            if (agents.length === 0) {
                console.log(`[DCAAssignment] No active agents found for DCA ${dcaId}`);
                return;
            }

            // Pick one (Random for now)
            const randomAgent = agents[Math.floor(Math.random() * agents.length)];

            kase.assignedAgentId = randomAgent._id;
            kase.assignedAgent = randomAgent.name;

            console.log(`[DCAAssignment] Auto-assigned Agent: ${randomAgent.name}`);

        } catch (err) {
            console.error('[DCAAssignment] Agent Assignment Error:', err);
        }
    }
}

module.exports = DCAAssignmentService;
