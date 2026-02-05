const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        console.log(`[RBAC] Checking access for User ID: ${req.user._id}, Role: ${req.user.role}. Required roles: ${roles.join(', ')}`);

        if (!roles.includes(req.user.role)) {
            console.warn(`[RBAC] Access denied for User ID: ${req.user._id}. Role '${req.user.role}' not in permitted roles: [${roles.join(', ')}]`);
            return res.status(403).json({
                message: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};

module.exports = { authorize };
