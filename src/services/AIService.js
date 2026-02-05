const Case = require('../models/Case');

class AIService {
    /**
     * Calculates Risk Score (0-100) based on predefined rules
     */
    static async calculateRiskScore(kase) {
        let score = 0;
        const now = new Date();

        // Rule 1: High Outstanding Amount (> $2000) -> +20
        if (kase.amount > 2000) score += 20;

        // Rule 2: Approaching SLA Deadline (< 48h) -> +20
        const slaDiff = new Date(kase.slaDeadline) - now;
        const hoursToSLA = slaDiff / (1000 * 60 * 60);
        if (hoursToSLA < 48 && hoursToSLA > 0) score += 20;
        if (hoursToSLA <= 0) score += 30; // Already breached or about to

        // Rule 3: Payment Delays (No payment > 30 days since creation) -> +30
        // If created > 30 days ago and totalRepaid is 0
        const daysSinceCreation = (now - new Date(kase.createdAt)) / (1000 * 60 * 60 * 24);
        if (daysSinceCreation > 30 && (!kase.totalRepaid || kase.totalRepaid === 0)) {
            score += 30;
        }

        // Rule 4: Customer History (Previous Breaches) -> +30
        // This is an async check, slightly expensive, but valuable.
        // We check if this customer has any other cases that are SLA_BREACHED
        const breachCount = await Case.countDocuments({
            customerId: kase.customerId,
            status: 'SLA_BREACHED',
            caseId: { $ne: kase.caseId } // exclude current
        });
        if (breachCount > 0) score += 30;

        // Cap at 100
        return Math.min(score, 100);
    }

    /**
     * Determines Priority Level based on Risk Score and SLA
     */
    static determinePriority(riskScore, slaDeadline) {
        const now = new Date();
        const slaDiff = new Date(slaDeadline) - now;
        const hoursToSLA = slaDiff / (1000 * 60 * 60);

        if (riskScore >= 70 || hoursToSLA < 24) {
            return 'HIGH';
        } else if (riskScore >= 30) {
            return 'MEDIUM';
        } else {
            return 'LOW';
        }
    }

    /**
     * Runs the full AI scoring logic for a case and updates it
     */
    static async runScoring(kase) {
        try {
            const riskScore = await this.calculateRiskScore(kase);
            const priority = this.determinePriority(riskScore, kase.slaDeadline);

            let updated = false;

            if (kase.riskScore !== riskScore) {
                kase.riskScore = riskScore;
                updated = true;
            }

            if (kase.aiSuggestedPriority !== priority) {
                kase.aiSuggestedPriority = priority;
                updated = true;
            }

            if (updated) {
                await kase.save();
                // We rely on BREService regarding logging to avoid circular deps or excessive logs
                return { riskScore, priority, updated: true };
            }

            return { riskScore, priority, updated: false };
        } catch (error) {
            console.error('[AIService] Scoring Error:', error);
            return null;
        }
    }
}

module.exports = AIService;
