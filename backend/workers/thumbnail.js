/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THUMBNAIL WORKER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This worker listens for 'file.uploaded' events and generates thumbnail images
 * for image files (JPG, PNG, GIF, etc.).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * HOW THIS WORKER RUNS IN DIFFERENT MODES:
 * ───────────────────────────────────────────────────────────────────────────
 *
 * [MONOLITH MODE]
 * ────────────────
 * - This file is required/imported by app.js
 * - Runs in the SAME process as your API server
 * - eventBus.subscribe() uses in-memory EventEmitter
 * - Thumbnail generation happens IMMEDIATELY after file upload
 * - Blocks API server resources (CPU, memory)
 *
 * Flow:
 *   User uploads file.jpg
 *   → File service: eventBus.publish('file.uploaded', data)
 *   → EventEmitter: Immediately calls this thumbnail handler
 *   → This handler: Creates thumbnail (takes 500ms)
 *   → Done! All in same process
 *
 * [MICROSERVICES MODE]
 * ────────────────────
 * - This file runs as a SEPARATE container (different process/machine)
 * - Entry point: node workers/thumbnail.js
 * - eventBus.subscribe() uses Kafka consumer
 * - Thumbnail generation happens ASYNCHRONOUSLY
 * - Doesn't affect API server at all!
 *
 * Flow:
 *   User uploads file.jpg in Container A (File Service)
 *   → File service: eventBus.publish('file.uploaded', data) to Kafka
 *   → Returns response to user IMMEDIATELY
 *   → Kafka: Stores message in topic
 *   → Container B (Thumbnail Worker): Reads message from Kafka
 *   → This handler: Creates thumbnail (takes 500ms)
 *   → Done! File service and thumbnail worker are independent
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY SEPARATE THUMBNAIL GENERATION?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * [Problem 1: User Waiting Time]
 * If you generate thumbnails synchronously during upload:
 * - Upload 1MB image: 200ms
 * - Generate thumbnail: 500ms
 * - Total user wait: 700ms ← User waits for thumbnail generation!
 *
 * With async event:
 * - Upload 1MB image: 200ms
 * - Publish event: 5ms
 * - Total user wait: 205ms ← User doesn't wait for thumbnail!
 * - Thumbnail generated in background
 *
 * [Problem 2: Resource Contention]
 * Thumbnail generation is CPU-intensive (image processing).
 * If done in API server process:
 * - API server CPU spikes when processing images
 * - Other API requests (login, folder list) become slow
 * - Bad user experience for unrelated operations
 *
 * With separate worker:
 * - API server stays responsive
 * - Thumbnail worker can use all CPU without affecting API
 * - Can scale independently (10 thumbnail workers, 2 API servers)
 *
 * [Problem 3: Scaling]
 * Imagine 100 users upload images simultaneously:
 * - Synchronous: API server needs to handle 100 thumbnail generations
 * - API server crashes or becomes very slow
 *
 * With worker queue:
 * - API server publishes 100 events (fast)
 * - 10 thumbnail workers process queue in parallel
 * - Each worker handles 10 images
 * - Total time: 10x faster!
 *
 * [Problem 4: Failure Isolation]
 * If thumbnail generation crashes (corrupted image, out of memory):
 * - Synchronous: Crashes entire API server
 * - All users affected, entire app down
 *
 * With separate worker:
 * - Only thumbnail worker crashes
 * - API server keeps running
 * - User uploads still work, just no thumbnails temporarily
 * - Auto-restart thumbnail worker (Docker restart policy)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS A THUMBNAIL?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A thumbnail is a SMALL version of an image:
 * - Original: vacation.jpg (3000x2000 pixels, 2MB)
 * - Thumbnail: vacation-thumb.jpg (200x133 pixels, 15KB)
 *
 * Purpose:
 * ✓ Faster loading in file browser (15KB vs 2MB)
 * ✓ Lower bandwidth usage
 * ✓ Better UI performance (don't load 100 full images)
 *
 * Where used:
 * - Grid view of files (show thumbnails)
 * - Preview before download
 * - Shared folder view
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IMPLEMENTATION NOTES:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This is a PLACEHOLDER implementation with detailed documentation.
 *
 * To make this production-ready, you'd need:
 *
 * 1. Install image processing library:
 *    npm install sharp
 *    (Sharp is fast, uses libvips, supports many formats)
 *
 * 2. Store thumbnails:
 *    - Local: uploads/thumbnails/
 *    - S3: same bucket, key: thumbnails/{fileId}.jpg
 *
 * 3. Update File model:
 *    - Add field: thumbnailKey (string, optional)
 *    - Add field: hasThumbnail (boolean, default false)
 *
 * 4. Handle errors:
 *    - Not an image → skip
 *    - Corrupted image → log and mark failed
 *    - Out of memory → restart worker
 *
 * 5. Optimization:
 *    - Generate multiple sizes (small: 200px, medium: 400px)
 *    - Use WebP format (50% smaller than JPEG)
 *    - Cache in CDN
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { getEventBus } = require('../utils/eventBus');
const File = require('../models/File');
const logger = require('../utils/logger');

/**
 * ───────────────────────────────────────────────────────────────────────────
 * CONFIGURATION
 * ───────────────────────────────────────────────────────────────────────────
 */

// Image MIME types we can create thumbnails for
const SUPPORTED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp'
];

// Thumbnail dimensions (width x height)
const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = 200;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: generateThumbnail
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Generate a thumbnail for an uploaded image file
 *
 * @param {object} event - Event data from 'file.uploaded' topic
 *
 * Event structure:
 * {
 *   fileId: '507f1f77bcf86cd799439011',      // MongoDB ObjectId
 *   userId: '507f191e810c19729de860ea',      // User who uploaded
 *   fileName: 'vacation.jpg',                // Original filename
 *   mimeType: 'image/jpeg',                  // File type
 *   fileSize: 2048000,                       // Size in bytes
 *   storageKey: 'uploads/user123/file.jpg',  // Where file is stored
 *   storageProvider: 'local',                // 'local' or 's3'
 *   folderId: '507f1f77bcf86cd799439012',   // Parent folder
 *   timestamp: '2024-01-10T12:34:56.789Z',   // When event created
 *   eventType: 'file.uploaded'               // Event name
 * }
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ALGORITHM STEP-BY-STEP:
 * ───────────────────────────────────────────────────────────────────────────
 *
 * 1. CHECK IF IMAGE
 *    - Read mimeType from event
 *    - If not an image (e.g., PDF, video) → skip (return early)
 *    - Log "Skipping non-image file"
 *
 * 2. FETCH FILE FROM DATABASE
 *    - Look up file by fileId in MongoDB
 *    - Get storageKey (where original file is stored)
 *    - If file not found → log error, return
 *
 * 3. DOWNLOAD ORIGINAL IMAGE
 *    - Get storage provider (local filesystem or S3)
 *    - Download original image bytes to memory
 *    - If download fails → log error, return
 *
 * 4. RESIZE IMAGE (Thumbnail Generation)
 *    - Load image from buffer using Sharp library
 *    - Resize to 200x200 pixels (maintaining aspect ratio)
 *    - Apply optimizations (compression, strip metadata)
 *    - Convert to JPEG if needed
 *
 * 5. UPLOAD THUMBNAIL
 *    - Save resized image to storage
 *    - Path: thumbnails/{fileId}.jpg
 *    - If local: ./uploads/thumbnails/
 *    - If S3: same bucket, different prefix
 *
 * 6. UPDATE DATABASE
 *    - Update File document in MongoDB
 *    - Set thumbnailKey = path to thumbnail
 *    - Set hasThumbnail = true
 *    - Now API can serve thumbnail instead of full image!
 *
 * 7. LOG SUCCESS
 *    - Log completion time
 *    - Log thumbnail size (should be much smaller than original)
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ERROR HANDLING:
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Possible errors:
 * - File not found in DB → Log warning (maybe deleted while processing)
 * - File not in storage → Log error (data corruption)
 * - Invalid image format → Log warning (skip)
 * - Out of memory → Let error propagate (worker restart)
 * - Database connection lost → Retry later (Kafka redelivery)
 *
 * Strategy:
 * - Transient errors (network) → Throw error, Kafka redelivers
 * - Permanent errors (invalid image) → Log and skip, commit offset
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function generateThumbnail(event) {
    const startTime = Date.now();

    try {
        logger.info('Thumbnail generation started', {
            component: 'thumbnail-worker',
            operation: 'generate',
            fileId: event.fileId,
            fileName: event.fileName,
            mimeType: event.mimeType,
            fileSize: event.fileSize
        });

        /**
         * ───────────────────────────────────────────────────────────────────
         * STEP 1: Check if this is an image file
         * ───────────────────────────────────────────────────────────────────
         *
         * We only generate thumbnails for images.
         * Videos, PDFs, documents don't get thumbnails (in this simple version).
         *
         * Production enhancement:
         * - Videos: Extract frame from video as thumbnail (ffmpeg)
         * - PDFs: Render first page as image (pdf2pic)
         * - Documents: Use generic icon based on file type
         */
        if (!SUPPORTED_IMAGE_TYPES.includes(event.mimeType)) {
            logger.debug('Skipping thumbnail generation - not an image', {
                component: 'thumbnail-worker',
                operation: 'generate',
                fileId: event.fileId,
                mimeType: event.mimeType,
                reason: 'unsupported_mime_type'
            });
            return; // Early return - nothing to do
        }

        /**
         * ───────────────────────────────────────────────────────────────────
         * STEP 2: Fetch file metadata from database
         * ───────────────────────────────────────────────────────────────────
         *
         * We need to know:
         * - storageKey: Where is the original file stored?
         * - storageProvider: Is it local filesystem or S3?
         * - Does file still exist? (might have been deleted while processing)
         */
        const file = await File.findById(event.fileId);

        if (!file) {
            logger.warn('File not found in database - may have been deleted', {
                component: 'thumbnail-worker',
                operation: 'generate',
                fileId: event.fileId,
                reason: 'file_deleted'
            });
            return; // File was deleted, skip thumbnail generation
        }

        /**
         * ───────────────────────────────────────────────────────────────────
         * STEP 3: Download original image from storage
         * ───────────────────────────────────────────────────────────────────
         *
         * This is where we'd actually retrieve the image bytes.
         *
         * Example with Sharp library (commented out, add later):
         *
         * const { getStorage } = require('../storage');
         * const storage = getStorage();
         * const imageBuffer = await storage.download(file.storageKey);
         *
         * imageBuffer is a Buffer containing the raw image data
         */

        /**
         * ───────────────────────────────────────────────────────────────────
         * STEP 4: Generate thumbnail using Sharp
         * ───────────────────────────────────────────────────────────────────
         *
         * Sharp is a high-performance image processing library.
         *
         * Example implementation (commented out - install sharp first):
         *
         * const sharp = require('sharp');
         *
         * const thumbnailBuffer = await sharp(imageBuffer)
         *   .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
         *     fit: 'inside',           // Maintain aspect ratio
         *     withoutEnlargement: true // Don't upscale small images
         *   })
         *   .jpeg({
         *     quality: 80,             // Compression level (80% quality)
         *     progressive: true        // Progressive JPEG (loads gradually)
         *   })
         *   .toBuffer();               // Return as Buffer
         *
         * This creates a 200x200px JPEG thumbnail.
         *
         * What each option means:
         * ─────────────────────────
         * fit: 'inside'
         *   → Image fits inside 200x200 box
         *   → Example: 1000x500 image becomes 200x100 (maintains aspect ratio)
         *   → Alternatives: 'cover' (fills box, crops), 'fill' (stretches)
         *
         * withoutEnlargement: true
         *   → Don't make small images bigger
         *   → Example: 50x50 image stays 50x50 (not stretched to 200x200)
         *
         * quality: 80
         *   → 80% JPEG quality (good balance of size vs quality)
         *   → 100 = best quality, largest file
         *   → 50 = poor quality, smallest file
         *
         * progressive: true
         *   → Creates progressive JPEG (loads in stages)
         *   → Better user experience on slow connections
         *   → First load: blurry preview
         *   → Then: gradually sharper
         */

        /**
         * ───────────────────────────────────────────────────────────────────
         * STEP 5: Upload thumbnail to storage
         * ───────────────────────────────────────────────────────────────────
         *
         * Save the generated thumbnail alongside the original.
         *
         * Example:
         *
         * const thumbnailKey = `thumbnails/${event.fileId}.jpg`;
         * await storage.upload(
         *   thumbnailKey,
         *   thumbnailBuffer,
         *   'image/jpeg',
         *   event.userId
         * );
         *
         * Storage structure:
         *   uploads/
         *     user123/
         *       abc123-vacation.jpg        ← Original (2MB)
         *   thumbnails/
         *     abc123.jpg                   ← Thumbnail (15KB)
         */

        /**
         * ───────────────────────────────────────────────────────────────────
         * STEP 6: Update database with thumbnail info
         * ───────────────────────────────────────────────────────────────────
         *
         * Mark file as having a thumbnail.
         *
         * Example:
         *
         * await File.findByIdAndUpdate(event.fileId, {
         *   thumbnailKey: thumbnailKey,
         *   hasThumbnail: true,
         *   thumbnailGeneratedAt: new Date()
         * });
         *
         * Now when frontend requests file list, it can show:
         * - Thumbnail: /api/files/{fileId}/thumbnail (fast, 15KB)
         * - Full image: /api/files/{fileId}/download (slow, 2MB)
         */

        /**
         * ───────────────────────────────────────────────────────────────────
         * PLACEHOLDER SUCCESS LOG
         * ───────────────────────────────────────────────────────────────────
         *
         * In production, this would show actual thumbnail file size, etc.
         */
        const duration = Date.now() - startTime;

        logger.info('Thumbnail generated successfully (PLACEHOLDER)', {
            component: 'thumbnail-worker',
            operation: 'generate',
            fileId: event.fileId,
            fileName: event.fileName,
            originalSize: event.fileSize,
            // thumbnailSize: thumbnailBuffer.length,  // Would show in production
            duration: duration,
            note: 'This is a placeholder - install Sharp library for actual implementation'
        });

    } catch (error) {
        const duration = Date.now() - startTime;

        logger.error('Thumbnail generation failed', {
            component: 'thumbnail-worker',
            operation: 'generate',
            fileId: event.fileId,
            fileName: event.fileName,
            duration: duration,
            error: {
                message: error.message,
                code: error.code,
                stack: error.stack
            }
        });

        /**
         * Re-throw error to trigger Kafka redelivery (microservices mode)
         * In monolith mode, error is logged but doesn't crash app
         */
        throw error;
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WORKER STARTUP
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This code runs when:
 * - MONOLITH MODE: app.js requires this file
 * - MICROSERVICES MODE: node workers/thumbnail.js
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHAT HAPPENS:
 * ───────────────────────────────────────────────────────────────────────────
 *
 * 1. Get EventBus instance (InMemory or Kafka based on DEPLOYMENT_MODE)
 *
 * 2. Subscribe to 'file.uploaded' topic
 *    - MONOLITH: EventEmitter.on('file.uploaded', generateThumbnail)
 *    - MICROSERVICES: Kafka consumer reads from 'file.uploaded' topic
 *
 * 3. For each event received:
 *    - Call generateThumbnail(event)
 *    - Handle errors
 *    - Continue to next event
 *
 * 4. Worker runs forever until:
 *    - Process killed (SIGTERM, Ctrl+C)
 *    - Unhandled error crashes process
 *    - Manual stop
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Get the event bus (singleton - same instance across entire app)
const eventBus = getEventBus();

// Subscribe to file upload events
eventBus.subscribe('file.uploaded', generateThumbnail);

logger.info('Thumbnail worker initialized and listening for events', {
    component: 'thumbnail-worker',
    operation: 'init',
    subscribedTo: ['file.uploaded'],
    supportedMimeTypes: SUPPORTED_IMAGE_TYPES,
    thumbnailSize: `${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT}`,
    deploymentMode: process.env.DEPLOYMENT_MODE || 'monolith'
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODULE ENTRY POINT CHECK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * If this file is run directly (not imported):
 *   node workers/thumbnail.js
 *
 * Then keep process alive (for microservices mode).
 *
 * If imported by app.js (monolith mode):
 *   require('./workers/thumbnail')
 *
 * Then this block is skipped, worker runs in main process.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * HOW require.main WORKS:
 * ───────────────────────────────────────────────────────────────────────────
 *
 * require.main = the module that started Node.js
 *
 * Example 1: node workers/thumbnail.js
 *   require.main = workers/thumbnail.js module
 *   module = workers/thumbnail.js module
 *   require.main === module → TRUE
 *
 * Example 2: node app.js (which does require('./workers/thumbnail'))
 *   require.main = app.js module
 *   module = workers/thumbnail.js module
 *   require.main === module → FALSE
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
if (require.main === module) {
    /**
     * This file was run directly as a microservice
     * Keep process alive to continue consuming events
     */
    logger.info('Thumbnail worker running as standalone service', {
        component: 'thumbnail-worker',
        operation: 'startup',
        mode: 'microservice',
        pid: process.pid,
        message: 'Worker will continue running until stopped'
    });

    /**
     * Handle uncaught errors gracefully
     * Don't let worker crash on random errors
     */
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception in thumbnail worker', {
            component: 'thumbnail-worker',
            operation: 'error_handler',
            error: {
                message: error.message,
                stack: error.stack
            }
        });

        // In production, you might want to:
        // 1. Log error to external monitoring (Sentry, DataDog)
        // 2. Exit process (let Docker restart it)
        // 3. Send alert to ops team
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled promise rejection in thumbnail worker', {
            component: 'thumbnail-worker',
            operation: 'error_handler',
            reason: reason
        });
    });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PRODUCTION CHECKLIST
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * To make this production-ready:
 *
 * [ ] Install Sharp library
 *     npm install sharp
 *
 * [ ] Implement actual image resizing (uncomment code above)
 *
 * [ ] Add thumbnail storage support
 *     - Local: mkdir uploads/thumbnails
 *     - S3: create /thumbnails prefix in bucket
 *
 * [ ] Update File model schema
 *     - Add: thumbnailKey (String, optional)
 *     - Add: hasThumbnail (Boolean, default false)
 *
 * [ ] Add thumbnail serving endpoint
 *     GET /api/files/:id/thumbnail
 *     - Check if hasThumbnail
 *     - Serve from thumbnailKey
 *     - Fallback to full image if no thumbnail
 *
 * [ ] Add error handling
 *     - Corrupted image → Skip and log
 *     - Out of memory → Restart worker
 *     - Database error → Retry
 *
 * [ ] Add monitoring
 *     - Track: thumbnails generated per minute
 *     - Alert: if success rate < 90%
 *     - Dashboard: queue length, processing time
 *
 * [ ] Add tests
 *     - Unit test: generateThumbnail function
 *     - Integration test: Upload image, verify thumbnail created
 *     - Load test: 1000 images, all thumbnails within 5 minutes
 *
 * [ ] Optimize performance
 *     - Batch processing (process 10 images at once)
 *     - Caching (don't regenerate if thumbnail exists)
 *     - Multiple sizes (small, medium, large)
 *     - WebP format (smaller than JPEG)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

module.exports = { generateThumbnail };
