const mongoose = require('mongoose');

const reconciliationReportSchema = mongoose.Schema({
    reportId: {
        type: String,
        required: true,
        unique: true
    },
    dcaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DCA',
        required: true
    },
    dcaCode: String, // Snapshot
    billingPeriod: {
        month: Number, // 1-12
        year: Number
    },
    generatedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['GENERATED', 'APPROVED', 'PAID'],
        default: 'GENERATED'
    },
    financials: {
        totalCollected: { type: Number, default: 0 }, // Sum of verified payments
        commissionRate: { type: Number, default: 0 }, // Rate at time of generation
        commissionAmount: { type: Number, default: 0 },
        netPayable: { type: Number, default: 0 }
    },
    paymentDetails: [{
        caseId: String,
        customerName: String,
        paymentDate: Date,
        amount: Number,
        commission: Number
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('ReconciliationReport', reconciliationReportSchema);
