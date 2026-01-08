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

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
if (process.env.STORAGE_PROVIDER === 's3' || process.env.STORAGE_PROVIDER === 'minio') {
    requiredEnvVars.push('S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY');
}

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
    logger.error('Missing required environment variables', {
        component: 'application',
        operation: 'startup',
        missingVars: missingEnvVars
    });
    console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
}

const app = express();

// Middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware (before routes)
app.use(requestLogger);

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection - Connect eagerly on startup
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
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

// Connect immediately on startup (not lazy - this is for VM/container deployment)
connectDB().catch(err => {
    console.error('Failed to connect to MongoDB on startup:', err.message);
    process.exit(1);
});

// Health check routes
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Storage Platform API is running' });
});

app.get('/api/health', async (req, res) => {
    try {
        const dbState = mongoose.connection.readyState;
        const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState];

        if (dbState !== 1) {
            return res.status(503).json({
                status: 'unhealthy',
                message: 'Database connection unavailable',
                mongodb: dbStatus
            });
        }

        res.json({
            status: 'ok',
            message: 'Storage Platform API is running',
            mongodb: dbStatus
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            mongodb: 'error'
        });
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
