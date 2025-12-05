const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection (lazy connect for serverless)
let isConnected = false;

const connectDB = async () => {
    if (isConnected) return;

    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI environment variable is not set');
    }

    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        isConnected = conn.connections[0].readyState === 1;
        console.log('✅ Connected to MongoDB');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        throw err;
    }
};

// Middleware to ensure DB connection
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('DB Error:', err);
        res.status(500).json({ error: 'Database connection failed', details: err.message });
    }
});

// Import routes
const authRoutes = require('../routes/auth');
const folderRoutes = require('../routes/folders');
const fileRoutes = require('../routes/files');
const publicRoutes = require('../routes/public');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/public', publicRoutes);

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Storage Platform API',
        mongodb: isConnected ? 'connected' : 'not connected'
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Storage Platform API',
        mongodb: isConnected ? 'connected' : 'not connected'
    });
});

// Export for Vercel
module.exports = app;
