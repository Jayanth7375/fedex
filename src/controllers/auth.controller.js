const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id, role, dcaId) => {
    return jwt.sign({ id, role, dcaId }, process.env.JWT_SECRET, {
        expiresIn: '24h', // As per requirements
    });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    console.log('[DEBUG] Login attempt for:', req.body.email);
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        console.log('[DEBUG] User found:', user ? user._id : 'No');

        if (user && (await user.matchPassword(password))) {
            console.log('[DEBUG] Password match success');
            res.json({
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                dcaId: user.dcaId,
                token: generateToken(user._id, user.role, user.dcaId),
            });
        } else {
            console.log('[DEBUG] Invalid credentials');
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error('[CRITICAL] Login Error:', error);
        res.status(500).json({ message: error.message, stack: error.stack });
    }
};

module.exports = { loginUser };
