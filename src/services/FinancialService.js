const Case = require('../models/Case');
const BREService = require('./BREService');
const mongoose = require('mongoose');

class FinancialService {

    /**
     * Records a new payment (Pending Verification)
     */
    /**
     * Records a new payment (Direct Verification Mode)
     * User requested removal of Admin Verification Queue.
     */
    static async recordPayment(caseId, { amount, method, referenceId, notes }, agentUser) {
        const kase = await Case.findOne({ caseId });
        if (!kase) throw new Error('Case not found');

        const numAmount = Number(amount);

        const payment = {
            amount: numAmount,
            method: method || 'ONLINE',
            referenceId,
            date: new Date(),
            status: 'VERIFIED', // Auto-verified
            verifiedBy: agentUser._id,
            verifiedAt: new Date()
        };

        kase.paymentHistory.push(payment);

        // IMMEDIATE EFFECT: Update Balance
        kase.totalRepaid = (kase.totalRepaid || 0) + numAmount;

        // IMMEDIATE EFFECT: Check for Auto-Close
        const targetAmount = kase.settlement?.status === 'APPROVED' ? kase.settlement.amount : kase.amount;

        if (kase.totalRepaid >= targetAmount) {
            kase.status = 'CLOSED';

            await BREService.logActivity({
                caseId: kase.caseId,
                action: 'CASE_CLOSED',
                user: 'SYSTEM',
                userId: agentUser._id,
                details: 'Case closed automatically after full payment.'
            });
        }

        await kase.save();

        await BREService.logActivity({
            caseId: kase.caseId,
            action: 'PAYMENT_RECEIVED',
            user: agentUser.name,
            userId: agentUser._id,
            details: `Payment of ${numAmount} collected via ${method}. Balance updated.`
        });

        return kase;
    }

    /**
     * Verifies a payment (Admin Only)
     */
    static async verifyPayment(caseId, paymentId, adminUser, verdict, rejectionReason = null) {
        const kase = await Case.findOne({ caseId });
        if (!kase) throw new Error('Case not found');

        const payment = kase.paymentHistory.id(paymentId);
        if (!payment) throw new Error('Payment record not found');

        if (payment.status !== 'PENDING_VERIFICATION') {
            throw new Error(`Payment is already ${payment.status}`);
        }

        if (verdict === 'APPROVE') {
            payment.status = 'VERIFIED';
            payment.verifiedBy = adminUser._id;
            payment.verifiedAt = new Date();

            // Only NOW do we update the totalRepaid
            kase.totalRepaid = (kase.totalRepaid || 0) + payment.amount;

            // Check for potential closure
            const targetAmount = kase.settlement?.status === 'APPROVED' ? kase.settlement.amount : kase.amount;
            if (kase.totalRepaid >= targetAmount) {
                kase.status = 'CLOSED';
                await BREService.logActivity({
                    caseId: kase.caseId,
                    action: 'CASE_CLOSED',
                    user: 'SYSTEM',
                    userId: adminUser._id,
                    details: 'Case closed after payment verification.'
                });
            }

            await BREService.logActivity({
                caseId: kase.caseId,
                action: 'PAYMENT_VERIFIED',
                user: adminUser.name,
                userId: adminUser._id,
                details: `Payment of ${payment.amount} verified.`
            });

        } else if (verdict === 'REJECT') {
            payment.status = 'REJECTED';
            payment.rejectionReason = rejectionReason;
            payment.verifiedBy = adminUser._id;
            payment.verifiedAt = new Date();

            await BREService.logActivity({
                caseId: kase.caseId,
                action: 'PAYMENT_REJECTED',
                user: adminUser.name,
                userId: adminUser._id,
                details: `Payment rejected. Reason: ${rejectionReason}`
            });
        } else {
            throw new Error('Invalid verdict. Use APPROVE or REJECT.');
        }

        await kase.save();
        return kase;
    }

    /**
     * Request Settlement (Agent)
     */
    static async requestSettlement(caseId, { amount, remarks }, agentUser) {
        const kase = await Case.findOne({ caseId });
        if (!kase) throw new Error('Case not found');

        if (kase.settlement?.status === 'APPROVED') {
            throw new Error('Settlement already approved for this case');
        }

        kase.settlement = {
            status: 'REQUESTED',
            amount: Number(amount),
            requestedBy: agentUser._id,
            requestedAt: new Date(),
            remarks
        };

        await kase.save();

        await BREService.logActivity({
            caseId: kase.caseId,
            action: 'SETTLEMENT_REQUESTED',
            user: agentUser.name,
            userId: agentUser._id,
            details: `Settlement requested for ${amount}. Remarks: ${remarks}`
        });

        return kase;
    }

    /**
     * Adjudicate Settlement (Admin)
     */
    static async adjudicateSettlement(caseId, action, adminUser, remarks = null) {
        const kase = await Case.findOne({ caseId });
        if (!kase) throw new Error('Case not found');

        const settlement = kase.settlement;
        if (!settlement || settlement.status !== 'REQUESTED') {
            throw new Error('No pending settlement request');
        }

        if (action === 'APPROVE') {
            settlement.status = 'APPROVED';
            settlement.reviewedBy = adminUser._id;
            settlement.reviewedAt = new Date();
            // Optional: update kase.amount or keep original? Keeping original is better for audit.

            await BREService.logActivity({
                caseId: kase.caseId,
                action: 'SETTLEMENT_APPROVED',
                user: adminUser.name,
                userId: adminUser._id,
                details: `Settlement approved for ${settlement.amount}`
            });

            // Check if already paid enough?
            if (kase.totalRepaid >= settlement.amount) {
                kase.status = 'CLOSED';
            }

        } else if (action === 'REJECT') {
            settlement.status = 'REJECTED';
            settlement.reviewedBy = adminUser._id;
            settlement.reviewedAt = new Date();
            settlement.remarks = remarks || settlement.remarks;

            await BREService.logActivity({
                caseId: kase.caseId,
                action: 'SETTLEMENT_REJECTED',
                user: adminUser.name,
                userId: adminUser._id,
                details: `Settlement rejected.`
            });
        } else {
            throw new Error('Invalid action');
        }

        await kase.save();
        return kase;
    }
}

module.exports = FinancialService;
