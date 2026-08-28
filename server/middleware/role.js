module.exports = function requireRole(allowedRoles = ['Admin']) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        if (allowedRoles.includes(req.user.role) || req.user.role === 'Admin') {
            return next();
        }
        return res.status(403).json({ error: 'Access denied: Insufficient role permissions' });
    };
};
