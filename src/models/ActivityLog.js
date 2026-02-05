const mongoose = require('mongoose');

const activityLogSchema = mongoose.Schema({
    caseId: {
        type: String,
        required: true,
        index: true
    },
    action: {
        type: String,
        required: true,
    },
    user: {
        type: String, // Name of the user performing action
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    details: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    }
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
