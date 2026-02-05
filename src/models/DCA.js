const mongoose = require('mongoose');

const dcaSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    supportedRegions: [{
        type: String,
        enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL']
    }],
    // Legacy field - kept for backward compatibility during migration, can be deprecated later
    region: {
        type: String,
        enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'],
        default: 'CENTRAL'
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE'],
        default: 'ACTIVE'
    },
    contactEmail: {
        type: String
    },
    performanceScore: {
        type: Number,
        default: 1.0 // 0.0 to 1.0
    },
    commissionRate: {
        type: Number,
        default: 10, // Percentage (e.g., 10%)
        min: 0,
        max: 100
    },
    totalCasesAssigned: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('DCA', dcaSchema);
