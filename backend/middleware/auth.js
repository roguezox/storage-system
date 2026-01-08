const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const auth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.userId);

        if (!user) {
            logger.warn('Authentication failed - user not found', {
                component: 'auth',
                operation: 'verify_token',
                userId: decoded.userId,
                ipAddress: req.ip,
                reason: 'user_deleted_or_invalid'
            });
            return res.status(401).json({ error: 'User not found.' });
        }

        req.user = user;
        req.userId = user._id;
        next();
    } catch (error) {
        logger.warn('Authentication failed - invalid token', {
            component: 'auth',
            operation: 'verify_token',
            error: error.message,
            ipAddress: req.ip,
            endpoint: req.path,
            method: req.method
        });
        res.status(401).json({ error: 'Invalid token.' });
    }
};

module.exports = auth;
