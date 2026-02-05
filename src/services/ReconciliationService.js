const Case = require('../models/Case');
const DCA = require('../models/DCA');
const ReconciliationReport = require('../models/ReconciliationReport');

class ReconciliationService {

    /**
     * Generates a monthly reconciliation report for a specific DCA
     * @param {String} dcaCode 
     * @param {Number} month 1-12
     * @param {Number} year 
     */
    static async generateMonthlyReport(dcaCode, month, year) {
        const dca = await DCA.findOne({ code: dcaCode });
        if (!dca) throw new Error('DCA not found');

        // Define Start and End of Month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        // Find all Verified Payments in this range for this DCA
        // We need to aggregate across cases assigned to this DCA
        const cases = await Case.find({ assignedDCA: dcaCode });

        const relevantPayments = [];
        let totalCollected = 0;

        for (const kase of cases) {
            // Filter payments: Verified AND within date range
            const payments = kase.paymentHistory.filter(p =>
                p.status === 'VERIFIED' &&
                p.verifiedAt >= startDate &&
                p.verifiedAt <= endDate
            );

            for (const p of payments) {
                relevantPayments.push({
                    caseId: kase.caseId,
                    customerName: kase.customerName,
                    paymentDate: p.verifiedAt,
                    amount: p.amount,
                    commission: p.amount * (dca.commissionRate / 100)
                });
                totalCollected += p.amount;
            }
        }

        const commissionAmount = totalCollected * (dca.commissionRate / 100);
        const netPayable = commissionAmount; // Simplified: DCA gets commission. Or FedEx gets (Collected - Commission). Let's assume Report shows DCA Commission Payable.

        const reportId = `REC-${dcaCode}-${year}-${String(month).padStart(2, '0')}`;

        // Create or Update Report
        const reportData = {
            reportId,
            dcaId: dca._id,
            dcaCode: dcaCode,
            billingPeriod: { month, year },
            status: 'GENERATED',
            financials: {
                totalCollected,
                commissionRate: dca.commissionRate,
                commissionAmount,
                netPayable
            },
            paymentDetails: relevantPayments
        };

        const report = await ReconciliationReport.findOneAndUpdate(
            { reportId },
            reportData,
            { upsert: true, new: true }
        );

        return report;
    }

    /**
     * Get Report by ID
     */
    static async getReport(reportId) {
        return await ReconciliationReport.findOne({ reportId }).populate('dcaId');
    }
}

module.exports = ReconciliationService;
