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
            ownerId: req.userId
        }).sort({ createdAt: -1 });

        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload file - store using storage provider
router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { folderId } = req.body;

        if (!folderId) {
            return res.status(400).json({ error: 'Folder ID is required' });
        }

        const storage = getStorage();

        // Upload to storage provider
        const { storageKey, size } = await storage.upload(
            req.file.originalname,
            req.file.buffer,
            req.file.mimetype,
            req.userId.toString()
        );

        const file = new File({
            name: `${generateUUID()}-${req.file.originalname}`,
            originalName: req.file.originalname,
            folderId,
            ownerId: req.userId,
            storageKey,
            storageProvider: storage.getType(),
            mimeType: req.file.mimetype,
            size
        });

        await file.save();
        res.status(201).json(file);
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
            ownerId: req.userId
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
            { _id: req.params.id, ownerId: req.userId },
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
        const file = await File.findOne({
            _id: req.params.id,
            ownerId: req.userId
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Delete from storage
        const storage = getStorage();
        await storage.delete(file.storageKey);

        // Delete from database
        await File.deleteOne({ _id: file._id });

        res.json({ message: 'File deleted successfully' });
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
            { _id: req.params.id, ownerId: req.userId },
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
            { _id: req.params.id, ownerId: req.userId },
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

module.exports = router;
