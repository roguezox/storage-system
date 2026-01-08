const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');

// Load environment variables (only in dev)
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const app = express();

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (before routes)
app.use(requestLogger);

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection (lazy connect)
let isConnected = false;

const connectDB = async () => {
    if (isConnected) return;

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        isConnected = true;
        logger.info('MongoDB connection established', {
            component: 'database',
            operation: 'connect',
            mongoUri: process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/\/\/.*@/, '//***@') : 'not_configured',
            environment: process.env.NODE_ENV || 'production'
        });
    } catch (err) {
        logger.error('MongoDB connection failed', {
            component: 'database',
            operation: 'connect',
            error: {
                message: err.message,
                code: err.code,
                name: err.name
            },
            mongoUri: process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/\/\/.*@/, '//***@') : 'not_configured'
        });
        throw err;
    }
};

// Health check routes (defined before DB middleware to ensure liveness probe works)
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Storage Platform API is running' });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Storage Platform API is running' });
});

// Connect on first request (for serverless)
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        res.status(500).json({ error: 'Database connection failed' });
    }
});

// Import routes
const authRoutes = require('./routes/auth');
const folderRoutes = require('./routes/folders');
const fileRoutes = require('./routes/files');
const publicRoutes = require('./routes/public');
const searchRoutes = require('./routes/search');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/search', searchRoutes);



// Start server if run directly
if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        const { getStorage } = require('./storage');
        const storage = getStorage();

        logger.info('Server started successfully', {
            component: 'application',
            operation: 'startup',
            port: PORT,
            environment: process.env.NODE_ENV || 'production',
            storageProvider: storage.getType(),
            nodeVersion: process.version,
            pid: process.pid
        });
    });
}

// Export for Vercel
module.exports = app;
