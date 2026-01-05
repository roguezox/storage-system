const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const File = require('../models/File');
const auth = require('../middleware/auth');
const { getStorage } = require('../storage');

const router = express.Router();

const generateUUID = () => crypto.randomUUID();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit (configurable via env)
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
            } catch (err) {
                console.error(`Failed to upload ${file.originalname}:`, err);
                errors.push({ filename: file.originalname, error: err.message });
            }
        }

        if (uploadedFiles.length === 0) {
            return res.status(500).json({
                error: 'All uploads failed',
                details: errors
            });
        }

        res.status(201).json({
            files: uploadedFiles,
            success: uploadedFiles.length,
            failed: errors.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Download/View file
router.get('/:id/download', async (req, res) => {
    try {
        const file = await File.findOne({
            _id: req.params.id,
            ownerId: req.userId,
            deletedAt: null
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        const storage = getStorage();
        const buffer = await storage.download(file.storageKey);

        res.set({
            'Content-Type': file.mimeType,
            'Content-Disposition': `inline; filename="${file.originalName}"`,
            'Content-Length': buffer.length
        });

        res.send(buffer);
    } catch (error) {
        console.error('Download error:', error);
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

        const file = await File.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.userId, deletedAt: null },
            { originalName: name },
            { new: true }
        );

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

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

        res.json({ message: 'File moved to trash' });
    } catch (error) {
        console.error('Delete error:', error);
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
        const file = await File.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.userId, deletedAt: null },
            { isShared: false, shareId: null },
            { new: true }
        );

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

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
            console.error(`Failed to delete ${file.storageKey} from storage:`, err);
            // Continue with database deletion even if storage deletion fails
        }

        // Delete from database
        await File.deleteOne({ _id: file._id });

        res.json({ message: 'File permanently deleted' });
    } catch (error) {
        console.error('Permanent delete error:', error);
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
                console.error(`Failed to delete ${file.storageKey}:`, err);
                // Continue with other files even if one fails
            }
        }

        // Delete from database
        const result = await File.deleteMany({
            ownerId: req.userId,
            deletedAt: { $ne: null }
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
