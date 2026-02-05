const mongoose = require('mongoose');

const noteSchema = mongoose.Schema({
    author: String,
    content: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const paymentHistorySchema = mongoose.Schema({
    amount: Number,
    date: {
        type: Date,
        default: Date.now
    },
    method: {
        type: String,
        enum: ['CASH', 'ONLINE', 'CHEQUE', 'BANK_TRANSFER'],
        default: 'ONLINE'
    },
    referenceId: String,
    status: {
        type: String,
        enum: ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'SUCCESS'],
        default: 'PENDING_VERIFICATION'
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    verifiedAt: Date,
    rejectionReason: String
});

const caseSchema = mongoose.Schema({
    caseId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    customerId: {
        type: String,
        required: true
    },
    customerName: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    totalRepaid: {
        type: Number,
        default: 0
    },
    region: {
        type: String,
        enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'],
        default: 'CENTRAL',
        index: true
    },
    status: {
        type: String,
        enum: ['OPEN', 'IN_PROGRESS', 'CLOSED', 'SLA_BREACHED', 'AT_RISK', 'NOT_ABLE_TO_PAY', 'CUSTOMER_DECLINED', 'ON_HOLD', 'CLOSED_UNRECOVERABLE'],
        default: 'OPEN',
        index: true
    },
    slaDeadline: {
        type: Date,
        required: true
    },
    dueDate: {
        type: Date,
        required: false // Optional for legacy, required for new imports
    },
    priorityScore: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.5
    },
    riskScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
        index: true
    },
    aiSuggestedPriority: {
        type: String,
        enum: ['HIGH', 'MEDIUM', 'LOW'],
        default: 'LOW',
        index: true
    },
    recoveryProbability: {
        type: Number,
        default: 0
    },
    settlement: {
        status: {
            type: String,
            enum: ['NONE', 'REQUESTED', 'APPROVED', 'REJECTED'],
            default: 'NONE'
        },
        amount: Number, // The proposed/approved settlement amount
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        requestedAt: Date,
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reviewedAt: Date,
        remarks: String
    },
    nonPaymentRequest: {
        status: {
            type: String,
            enum: ['NONE', 'PENDING', 'APPROVED', 'REJECTED'],
            default: 'NONE'
        },
        reason: {
            type: String,
            enum: ['HARDSHIP', 'DISPUTE', 'DECEASED', 'BANKRUPTCY', 'REFUSAL', 'OTHER'],
        },
        description: String,
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        requestedAt: Date,
        adminDecision: {
            type: String,
            enum: ['EXTEND_SLA', 'HOLD', 'CLOSE_UNRECOVERABLE', 'REJECT']
        },
        adminComments: String,
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reviewedAt: Date
    },
    assignedDCA: {
        type: String,
        default: null,
        index: true
    },
    assignedAgent: {
        type: String, // Name of the agent
        default: null
    },
    assignedAgentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    notes: [noteSchema],
    paymentHistory: [paymentHistorySchema]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for activity logs (if we want to populate them)
caseSchema.virtual('activityLogs', {
    ref: 'ActivityLog',
    localField: 'caseId',
    foreignField: 'caseId',
    justOne: false,
    options: { sort: { timestamp: -1 } }
});

module.exports = mongoose.model('Case', caseSchema);
