const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const File = require('../models/File');
const auth = require('../middleware/auth');

const router = express.Router();

// Generate UUID using built-in crypto
const generateUUID = () => crypto.randomUUID();

// Configure multer for memory storage (not disk)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 16 * 1024 * 1024 // 16MB limit (MongoDB document limit is 16MB)
    }
});

// All routes require authentication
router.use(auth);

// Get files by folder
router.get('/folder/:folderId', async (req, res) => {
    try {
        // Don't return the file data in list view (too heavy)
        const files = await File.find({
            folderId: req.params.folderId,
            ownerId: req.userId
        }).select('-data').sort({ createdAt: -1 });

        res.json(files);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload file - store in MongoDB
router.post('/', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { folderId } = req.body;

        if (!folderId) {
            return res.status(400).json({ error: 'Folder ID is required' });
        }

        // Convert file buffer to base64
        const base64Data = req.file.buffer.toString('base64');

        const file = new File({
            name: `${generateUUID()}-${req.file.originalname}`,
            originalName: req.file.originalname,
            folderId,
            ownerId: req.userId,
            data: base64Data,
            mimeType: req.file.mimetype,
            size: req.file.size
        });

        await file.save();

        // Return file without data field
        const { data, ...fileWithoutData } = file.toObject();
        res.status(201).json(fileWithoutData);
    } catch (error) {
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

        // Convert base64 back to buffer
        const buffer = Buffer.from(file.data, 'base64');

        res.set({
            'Content-Type': file.mimeType,
            'Content-Disposition': `inline; filename="${file.originalName}"`,
            'Content-Length': buffer.length
        });

        res.send(buffer);
    } catch (error) {
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
        ).select('-data');

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
        const file = await File.findOneAndDelete({
            _id: req.params.id,
            ownerId: req.userId
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.json({ message: 'File deleted successfully' });
    } catch (error) {
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
        ).select('-data');

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
        ).select('-data');

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.json({ message: 'Share link revoked' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
