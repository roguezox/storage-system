const mongoose = require('mongoose');
const { getEventBus } = require('../utils/eventBus');
const logger = require('../utils/logger');

// Get the event bus instance
const eventBus = getEventBus();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000
}).then(() => {
    logger.info('[THUMBNAIL WORKER] Connected to MongoDB');

    // Subscribe to file upload events after MongoDB is connected
    eventBus.subscribe('file.uploaded', async (data) => {
        try {
            logger.info('[THUMBNAIL WORKER] Processing file', { fileId: data.fileId });

            // TODO: Generate thumbnail logic here
            // For now, just log

            logger.info('[THUMBNAIL WORKER] Thumbnail generated', { fileId: data.fileId });
        } catch (error) {
            logger.error('[THUMBNAIL WORKER] Error processing file', {
                fileId: data.fileId,
                error: error.message
            });
        }
    });

    logger.info('[THUMBNAIL WORKER] Started and ready to process events');
}).catch(err => {
    logger.error('[THUMBNAIL WORKER] MongoDB connection error:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('[THUMBNAIL WORKER] Shutting down gracefully...');
    await eventBus.close();
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('[THUMBNAIL WORKER] Shutting down gracefully...');
    await eventBus.close();
    await mongoose.connection.close();
    process.exit(0);
});

