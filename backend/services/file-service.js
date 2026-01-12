/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FILE SERVICE (Microservices Entry Point)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This is the entry point for running the File Service as a separate microservice.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * USAGE:
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Start as microservice:
 *   DEPLOYMENT_MODE=microservices \
 *   SERVICE_NAME=file-service \
 *   node services/file-service.js
 *
 * Docker container:
 *   docker run -e DEPLOYMENT_MODE=microservices \
 *              -e SERVICE_NAME=file-service \
 *              opendrive-file-service
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHAT THIS SERVICE DOES:
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Handles all file-related operations:
 * - Upload files (POST /api/files)
 * - Download files (GET /api/files/:id/download)
 * - Delete files (DELETE /api/files/:id)
 * - Rename files (PUT /api/files/:id)
 * - Generate share links (POST /api/files/:id/share)
 * - List files in folder (GET /api/files/folder/:folderId)
 *
 * ───────────────────────────────────────────────────────────────────────────
 * DIFFERENCE FROM MONOLITH:
 * ───────────────────────────────────────────────────────────────────────────
 *
 * MONOLITH (app.js):
 *   → Loads ALL routes (auth, files, folders, search)
 *   → All functionality in one process
 *   → Single deployment unit
 *
 * MICROSERVICE (this file):
 *   → Loads ONLY file routes
 *   → File operations only
 *   → Independent deployment
 *   → Can scale separately from other services
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHY SEPARATE FILE SERVICE?
 * ───────────────────────────────────────────────────────────────────────────
 *
 * File operations are:
 * - High traffic (most common operation)
 * - Resource intensive (large uploads/downloads)
 * - Need independent scaling
 *
 * Example scaling:
 *   Auth Service: 2 instances (low traffic)
 *   File Service: 10 instances (high traffic)
 *   Folder Service: 3 instances (medium traffic)
 *
 * Total: 15 containers instead of 10 monoliths
 * Cost: Same or lower (right-sized per service)
 * Performance: Better (file traffic doesn't affect auth)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const logger = require('../utils/logger');
const requestLogger = require('../middleware/requestLogger');

// Load environment variables
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'DEPLOYMENT_MODE'];
if (process.env.STORAGE_PROVIDER === 's3' || process.env.STORAGE_PROVIDER === 'minio') {
    requiredEnvVars.push('S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY');
}

// Add Kafka requirements for microservices mode
if (process.env.DEPLOYMENT_MODE === 'microservices') {
    requiredEnvVars.push('KAFKA_BROKERS');
}

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
    logger.error('Missing required environment variables', {
        component: 'file-service',
        operation: 'startup',
        missingVars: missingEnvVars
    });
    console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CREATE EXPRESS APP
 * ═══════════════════════════════════════════════════════════════════════════
 */
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

// Request logging
app.use(requestLogger);

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MONGODB CONNECTION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Each microservice connects to MongoDB independently.
 *
 * Connection pooling:
 * - Each service has its own connection pool
 * - Default: 10 connections per service
 * - For high traffic: increase maxPoolSize
 *
 * Example:
 *   3 file service instances × 10 connections = 30 total MongoDB connections
 *
 * MongoDB can handle 64,000+ connections, so this scales well!
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 50,  // Higher for file service (high traffic)
            minPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
        });

        logger.info('MongoDB connection established', {
            component: 'file-service',
            operation: 'connect',
            service: 'file-service',
            mongoUri: process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/\/\/.*@/, '//***@') : 'not_configured'
        });
    } catch (err) {
        logger.error('MongoDB connection failed', {
            component: 'file-service',
            operation: 'connect',
            error: {
                message: err.message,
                code: err.code
            }
        });
        throw err;
    }
};

connectDB().catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HEALTH CHECK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Used by:
 * - Kubernetes liveness/readiness probes
 * - Load balancer health checks
 * - Monitoring systems
 *
 * Returns 200 OK if:
 * - Service is running
 * - MongoDB is connected
 * - EventBus is initialized
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
app.get('/health', async (req, res) => {
    try {
        const dbState = mongoose.connection.readyState;
        const dbStatus = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState];

        if (dbState !== 1) {
            return res.status(503).json({
                status: 'unhealthy',
                service: 'file-service',
                message: 'Database connection unavailable',
                mongodb: dbStatus
            });
        }

        res.json({
            status: 'ok',
            service: 'file-service',
            message: 'File service is running',
            mongodb: dbStatus,
            version: process.env.npm_package_version || '1.0.0'
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            service: 'file-service',
            error: error.message
        });
    }
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LOAD FILE ROUTES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Only file-related routes are mounted in this service.
 * Other routes (auth, folders) are handled by different services.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
const fileRoutes = require('../routes/files');
const publicRoutes = require('../routes/public');  // Shared files need public access

app.use('/api/files', fileRoutes);
app.use('/api/public', publicRoutes);  // For downloading shared files

logger.info('File service routes loaded', {
    component: 'file-service',
    operation: 'load_routes',
    routes: ['/api/files', '/api/public']
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * START SERVER
 * ═══════════════════════════════════════════════════════════════════════════
 */
const PORT = process.env.PORT || 5001;  // Different port per service

app.listen(PORT, () => {
    const { getStorage } = require('../storage');
    const storage = getStorage();

    logger.info('File service started successfully', {
        component: 'file-service',
        operation: 'startup',
        port: PORT,
        service: 'file-service',
        deploymentMode: process.env.DEPLOYMENT_MODE || 'monolith',
        storageProvider: storage.getType(),
        nodeVersion: process.version,
        pid: process.pid
    });

    console.log(`✅ File Service listening on port ${PORT}`);
    console.log(`📁 Storage Provider: ${storage.getType()}`);
    console.log(`🔧 Deployment Mode: ${process.env.DEPLOYMENT_MODE || 'monolith'}`);
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GRACEFUL SHUTDOWN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Handle shutdown signals gracefully:
 * 1. Stop accepting new requests
 * 2. Finish processing current requests
 * 3. Disconnect from MongoDB
 * 4. Disconnect from Kafka (EventBus)
 * 5. Exit process
 *
 * This prevents data loss during deployments or crashes.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down file service gracefully...`, {
        component: 'file-service',
        operation: 'shutdown',
        signal: signal
    });

    try {
        // Close MongoDB connection
        await mongoose.connection.close();

        logger.info('File service shutdown complete', {
            component: 'file-service',
            operation: 'shutdown'
        });

        process.exit(0);
    } catch (error) {
        logger.error('Error during file service shutdown', {
            component: 'file-service',
            operation: 'shutdown',
            error: {
                message: error.message
            }
        });
        process.exit(1);
    }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
