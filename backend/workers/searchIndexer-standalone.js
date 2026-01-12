const mongoose = require('mongoose');
const eventBus = require('../utils/eventBus');
const logger = require('../utils/logger');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000
}).then(() => {
    logger.info('[SEARCH WORKER] Connected to MongoDB');
}).catch(err => {
    logger.error('[SEARCH WORKER] MongoDB connection error:', err);
    process.exit(1);
});

// Subscribe to file events
eventBus.subscribe('file.uploaded', async (data) => {
    try {
        logger.info('[SEARCH WORKER] Indexing file', { fileId: data.fileId });

        // TODO: Update search index
        // For now, just log

        logger.info('[SEARCH WORKER] File indexed', { fileId: data.fileId });
    } catch (error) {
        logger.error('[SEARCH WORKER] Error indexing file', {
            fileId: data.fileId,
            error: error.message
        });
    }
});

eventBus.subscribe('file.deleted', async (data) => {
    try {
        logger.info('[SEARCH WORKER] Removing from index', { fileId: data.fileId });

        // TODO: Remove from search index

        logger.info('[SEARCH WORKER] File removed from index', { fileId: data.fileId });
    } catch (error) {
        logger.error('[SEARCH WORKER] Error removing from index', {
            fileId: data.fileId,
            error: error.message
        });
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('[SEARCH WORKER] Shutting down gracefully...');
    await eventBus.disconnect();
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('[SEARCH WORKER] Shutting down gracefully...');
    await eventBus.disconnect();
    await mongoose.connection.close();
    process.exit(0);
});

logger.info('[SEARCH WORKER] Started and ready to process events');
