const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const File = require('../models/File');
const Folder = require('../models/Folder');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// All routes require authentication
router.use(auth);

// Get files in a folder
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

// Upload file
router.post('/', upload.single('file'), async (req, res) => {
    try {
        const { folderId } = req.body;

        if (!folderId) {
            return res.status(400).json({ error: 'Folder ID is required' });
        }

        // Verify folder exists and belongs to user
        const folder = await Folder.findOne({
            _id: folderId,
            ownerId: req.userId
        });

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = new File({
            name: req.file.originalname,
            originalName: req.file.originalname,
            folderId,
            ownerId: req.userId,
            url: `/uploads/${req.file.filename}`,
            mimeType: req.file.mimetype,
            size: req.file.size
        });

        await file.save();
        res.status(201).json(file);
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
            { name },
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

        // Delete physical file
        const filePath = path.join(__dirname, '..', file.url);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await File.deleteOne({ _id: req.params.id });

        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate share link
router.post('/:id/share', async (req, res) => {
    try {
        const shareId = uuidv4();

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
