const internalAuth = (req, res, next) => {
    const secret = req.headers['x-internal-secret'];
    
    if (secret === 'fedex-dca-secret') {
        // Create a dummy user for logging purposes
        req.user = {
            name: 'n8n Automation',
            _id: null,
            role: 'SYSTEM'
        };
        return next();
    }
    
    return res.status(401).json({ message: 'Invalid internal secret' });
};

module.exports = internalAuth;

