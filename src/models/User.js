const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['ADMIN', 'MANAGER', 'DCA_MANAGER', 'AGENT'],
        default: 'AGENT',
    },
    dcaId: {
        type: String, // For Managers/Agents to link to a specific DCA
        default: null
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE'],
        default: 'ACTIVE'
    },
    supportedRegions: [{
        type: String,
        enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL']
    }],
    region: {
        type: String,
        enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'],
        default: 'CENTRAL'
    }
}, {
    timestamps: true,
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model('User', userSchema);
