const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            logger.warn('Registration failed - user already exists', {
                component: 'auth',
                operation: 'register',
                email: email,
                ipAddress: req.ip,
                reason: 'duplicate_user'
            });
            return res.status(400).json({ error: 'User already exists' });
        }

        const user = new User({ email, password, role: 'admin' });
        await user.save();

        logger.info('User registered successfully', {
            component: 'auth',
            operation: 'register',
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        logger.error('Registration error', {
            component: 'auth',
            operation: 'register',
            error: {
                message: error.message,
                stack: error.stack
            },
            email: req.body.email,
            ipAddress: req.ip
        });
        res.status(500).json({ error: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            logger.warn('Login failed - invalid credentials', {
                component: 'auth',
                operation: 'login',
                email: email,
                ipAddress: req.ip,
                reason: 'user_not_found'
            });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            logger.warn('Login failed - invalid credentials', {
                component: 'auth',
                operation: 'login',
                email: email,
                ipAddress: req.ip,
                reason: 'wrong_password'
            });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        logger.info('User logged in successfully', {
            component: 'auth',
            operation: 'login',
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            tokenExpiresIn: '7d'
        });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        logger.error('Login error', {
            component: 'auth',
            operation: 'login',
            error: {
                message: error.message,
                stack: error.stack
            },
            email: req.body.email,
            ipAddress: req.ip
        });
        res.status(500).json({ error: error.message });
    }
});

// Get current user
router.get('/me', require('../middleware/auth'), async (req, res) => {
    res.json({
        user: {
            id: req.user._id,
            email: req.user.email,
            role: req.user.role
        }
    });
});

module.exports = router;
