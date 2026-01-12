const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const File = require('../models/File');
const auth = require('../middleware/auth');
const { getStorage } = require('../storage');
const logger = require('../utils/logger');
const { getEventBus } = require('../utils/eventBus');

const router = express.Router();

// Get EventBus instance (works in both monolith and microservices mode)
const eventBus = getEventBus();

const generateUUID = () => crypto.randomUUID();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600') // 100MB default (100 * 1024 * 1024)
    }
});

// All routes require authentication
router.use(auth);

// Get files by folder
router.get('/folder/:folderId', async (req, res) => {
    try {
        const files = await File.find({
            folderId: req.params.folderId,
            ownerId: req.userId,
            deletedAt: null
        }).sort({ createdAt: -1 });

        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload file(s) - store using storage provider (supports multiple files)
router.post('/', upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const { folderId } = req.body;

        if (!folderId) {
            return res.status(400).json({ error: 'Folder ID is required' });
        }

        const storage = getStorage();
        const uploadedFiles = [];
        const errors = [];

        for (const file of req.files) {
            try {
                const uploadStartTime = Date.now();

                // Upload to storage provider
                const { storageKey, size } = await storage.upload(
                    file.originalname,
                    file.buffer,
                    file.mimetype,
                    req.userId.toString()
                );

                const fileDoc = new File({
                    name: `${generateUUID()}-${file.originalname}`,
                    originalName: file.originalname,
                    folderId,
                    ownerId: req.userId,
                    storageKey,
                    storageProvider: storage.getType(),
                    mimeType: file.mimetype,
                    size
                });

                await fileDoc.save();
                uploadedFiles.push(fileDoc);

                const uploadDuration = Date.now() - uploadStartTime;
                logger.info('File uploaded successfully', {
                    component: 'files',
                    operation: 'upload',
                    userId: req.userId.toString(),
                    folderId: folderId,
                    fileId: fileDoc._id.toString(),
                    fileName: file.originalname,
                    fileSize: size,
                    mimeType: file.mimetype,
                    storageProvider: storage.getType(),
                    storageKey: storageKey,
                    duration: uploadDuration
                });

                /**
                 * PUBLISH EVENT: file.uploaded
                 * ═══════════════════════════════════════════════════════════
                 *
                 * After successfully uploading a file, publish an event.
                 *
                 * This event will be consumed by:
                 * - Thumbnail worker (generates thumbnail for images)
                 * - Search indexer (adds file to search index)
                 * - Analytics service (tracks upload statistics)
                 * - Audit logger (records file operations)
                 *
                 * In MONOLITH mode:
                 *   → Workers receive event immediately (in-memory)
                 *   → All processing happens in same process
                 *
                 * In MICROSERVICES mode:
                 *   → Event sent to Kafka
                 *   → Workers in separate containers consume event
                 *   → Async processing, no blocking
                 *
                 * We don't await this publish because:
                 * - User doesn't need to wait for thumbnail/indexing
                 * - Faster response time
                 * - Fire-and-forget pattern
                 */
                eventBus.publish('file.uploaded', {
                    fileId: fileDoc._id.toString(),
                    userId: req.userId.toString(),
                    fileName: file.originalname,
                    mimeType: file.mimetype,
                    fileSize: size,
                    storageKey: storageKey,
                    storageProvider: storage.getType(),
                    folderId: folderId
                }).catch(error => {
                    // Log error but don't fail the upload
                    logger.error('Failed to publish file.uploaded event', {
                        component: 'files',
                        operation: 'publish_event',
                        fileId: fileDoc._id.toString(),
                        error: {
                            message: error.message,
                            stack: error.stack
                        }
                    });
                });
            } catch (err) {
                logger.error('File upload failed', {
                    component: 'files',
                    operation: 'upload',
                    userId: req.userId.toString(),
                    folderId: folderId,
                    fileName: file.originalname,
                    fileSize: file.size,
                    error: {
                        message: err.message,
                        stack: err.stack
                    }
                });
                errors.push({ filename: file.originalname, error: err.message });
            }
        }

        if (uploadedFiles.length === 0) {
            return res.status(500).json({
                error: 'All uploads failed',
                details: errors
            });
        }

        logger.info('Batch upload completed', {
            component: 'files',
            operation: 'batch_upload',
            userId: req.userId.toString(),
            folderId: folderId,
            totalFiles: req.files.length,
            successCount: uploadedFiles.length,
            failureCount: errors.length,
            totalSize: uploadedFiles.reduce((sum, f) => sum + f.size, 0)
        });

        res.status(201).json({
            files: uploadedFiles,
            success: uploadedFiles.length,
            failed: errors.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        logger.error('Upload error', {
            component: 'files',
            operation: 'upload',
            userId: req.userId.toString(),
            error: {
                message: error.message,
                stack: error.stack
            }
        });
        res.status(500).json({ error: error.message });
    }
});

// Download/View file
router.get('/:id/download', async (req, res) => {
    try {
        const downloadStartTime = Date.now();

        const file = await File.findOne({
            _id: req.params.id,
            ownerId: req.userId,
            deletedAt: null
        });

        if (!file) {
            logger.warn('File download failed - not found', {
                component: 'files',
                operation: 'download',
                userId: req.userId.toString(),
                fileId: req.params.id,
                reason: 'file_not_found_or_no_access'
            });
            return res.status(404).json({ error: 'File not found' });
        }

        const storage = getStorage();
        const buffer = await storage.download(file.storageKey);

        const downloadDuration = Date.now() - downloadStartTime;
        logger.info('File downloaded', {
            component: 'files',
            operation: 'download',
            userId: req.userId.toString(),
            fileId: file._id.toString(),
            fileName: file.originalName,
            fileSize: buffer.length,
            mimeType: file.mimeType,
            storageKey: file.storageKey,
            duration: downloadDuration
        });

        res.set({
            'Content-Type': file.mimeType,
            'Content-Disposition': `inline; filename="${file.originalName}"`,
            'Content-Length': buffer.length
        });

        res.send(buffer);
    } catch (error) {
        logger.error('File download failed', {
            component: 'files',
            operation: 'download',
            userId: req.userId.toString(),
            fileId: req.params.id,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
        res.status(500).json({ error: error.message });
    }
});

// Rename file
router.put('/:id', async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'File name is required' });
        }

        const oldFile = await File.findOne({ _id: req.params.id, ownerId: req.userId, deletedAt: null });
        const oldName = oldFile ? oldFile.originalName : 'unknown';

        const file = await File.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.userId, deletedAt: null },
            { originalName: name },
            { new: true }
        );

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        logger.info('File renamed', {
            component: 'files',
            operation: 'rename',
            userId: req.userId.toString(),
            fileId: file._id.toString(),
            oldName: oldName,
            newName: name
        });

        res.json(file);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete file
router.delete('/:id', async (req, res) => {
    try {
        // Soft delete file by setting deletedAt timestamp
        const file = await File.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.userId, deletedAt: null },
            { deletedAt: new Date() },
            { new: true }
        );

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        logger.info('File moved to trash', {
            component: 'files',
            operation: 'soft_delete',
            userId: req.userId.toString(),
            fileId: file._id.toString(),
            fileName: file.originalName,
            fileSize: file.size,
            storageKey: file.storageKey
        });

        /**
         * PUBLISH EVENT: file.deleted
         * ═══════════════════════════════════════════════════════════════
         *
         * Publish event when file is moved to trash (soft delete).
         *
         * Consumers:
         * - Search indexer: Remove file from search results
         * - Analytics: Track deletion patterns
         * - Audit logger: Record deletion for compliance
         *
         * Fire-and-forget: Don't wait for event processing
         */
        eventBus.publish('file.deleted', {
            fileId: file._id.toString(),
            userId: req.userId.toString(),
            fileName: file.originalName,
            fileSize: file.size,
            storageKey: file.storageKey
        }).catch(error => {
            logger.error('Failed to publish file.deleted event', {
                component: 'files',
                operation: 'publish_event',
                fileId: file._id.toString(),
                error: { message: error.message }
            });
        });

        res.json({ message: 'File moved to trash' });
    } catch (error) {
        logger.error('File delete failed', {
            component: 'files',
            operation: 'soft_delete',
            userId: req.userId.toString(),
            fileId: req.params.id,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
        res.status(500).json({ error: error.message });
    }
});

// Generate share link
router.post('/:id/share', async (req, res) => {
    try {
        const shareId = generateUUID();

        const file = await File.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.userId, deletedAt: null },
            { isShared: true, shareId },
            { new: true }
        );

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        logger.info('File share link generated', {
            component: 'files',
            operation: 'generate_share',
            userId: req.userId.toString(),
            fileId: file._id.toString(),
            fileName: file.originalName,
            shareId: shareId,
            shareUrl: `/public/${shareId}`
        });

        res.json({
            message: 'Share link generated',
            shareId: file.shareId,
            shareUrl: `/public/${file.shareId}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Revoke share link
router.delete('/:id/share', async (req, res) => {
    try {
        const oldFile = await File.findOne({ _id: req.params.id, ownerId: req.userId, deletedAt: null });
        const oldShareId = oldFile ? oldFile.shareId : null;

        const file = await File.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.userId, deletedAt: null },
            { isShared: false, shareId: null },
            { new: true }
        );

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        logger.info('File share link revoked', {
            component: 'files',
            operation: 'revoke_share',
            userId: req.userId.toString(),
            fileId: file._id.toString(),
            fileName: file.originalName,
            oldShareId: oldShareId
        });

        res.json({ message: 'Share link revoked' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Trash Management Endpoints

// Get all trashed files
router.get('/trash/list', async (req, res) => {
    try {
        const files = await File.find({
            ownerId: req.userId,
            deletedAt: { $ne: null }
        }).sort({ deletedAt: -1 });

        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Restore file from trash
router.post('/:id/restore', async (req, res) => {
    try {
        const file = await File.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.userId, deletedAt: { $ne: null } },
            { deletedAt: null },
            { new: true }
        );

        if (!file) {
            return res.status(404).json({ error: 'File not found in trash' });
        }

        logger.info('File restored from trash', {
            component: 'files',
            operation: 'restore',
            userId: req.userId.toString(),
            fileId: file._id.toString(),
            fileName: file.originalName,
            folderId: file.folderId.toString()
        });

        res.json({ message: 'File restored successfully', file });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Permanently delete file
router.delete('/:id/permanent', async (req, res) => {
    try {
        const file = await File.findOne({
            _id: req.params.id,
            ownerId: req.userId,
            deletedAt: { $ne: null }
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found in trash' });
        }

        // Delete from storage
        const storage = getStorage();
        try {
            await storage.delete(file.storageKey);
        } catch (err) {
            logger.warn('Storage deletion failed, continuing with DB deletion', {
                component: 'files',
                operation: 'permanent_delete',
                userId: req.userId.toString(),
                fileId: file._id.toString(),
                storageKey: file.storageKey,
                error: {
                    message: err.message
                }
            });
            // Continue with database deletion even if storage deletion fails
        }

        // Delete from database
        await File.deleteOne({ _id: file._id });

        logger.info('File permanently deleted', {
            component: 'files',
            operation: 'permanent_delete',
            userId: req.userId.toString(),
            fileId: file._id.toString(),
            fileName: file.originalName,
            fileSize: file.size,
            storageKey: file.storageKey,
            storageProvider: storage.getType()
        });

        res.json({ message: 'File permanently deleted' });
    } catch (error) {
        logger.error('Permanent delete error', {
            component: 'files',
            operation: 'permanent_delete',
            userId: req.userId.toString(),
            fileId: req.params.id,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
        res.status(500).json({ error: error.message });
    }
});

// Empty entire trash
router.post('/trash/empty', async (req, res) => {
    try {
        const files = await File.find({
            ownerId: req.userId,
            deletedAt: { $ne: null }
        });

        const storage = getStorage();
        let deletedCount = 0;

        // Delete from storage
        for (const file of files) {
            try {
                await storage.delete(file.storageKey);
                deletedCount++;
            } catch (err) {
                logger.warn(`Failed to delete file from storage`, {
                    component: 'files',
                    operation: 'empty_trash',
                    userId: req.userId.toString(),
                    fileId: file._id.toString(),
                    storageKey: file.storageKey,
                    error: {
                        message: err.message
                    }
                });
                // Continue with other files even if one fails
            }
        }

        // Delete from database
        const result = await File.deleteMany({
            ownerId: req.userId,
            deletedAt: { $ne: null }
        });

        logger.info('Trash emptied', {
            component: 'files',
            operation: 'empty_trash',
            userId: req.userId.toString(),
            totalFiles: files.length,
            deletedCount: deletedCount,
            failedCount: files.length - deletedCount
        });

        res.json({
            message: 'Trash emptied successfully',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
