const express = require('express');
const crypto = require('crypto');
const Folder = require('../models/Folder');
const File = require('../models/File');
const auth = require('../middleware/auth');

const router = express.Router();

// Generate UUID using built-in crypto
const generateUUID = () => crypto.randomUUID();

// All routes require authentication
router.use(auth);

// Get all root folders
router.get('/', async (req, res) => {
    try {
        const folders = await Folder.find({
            ownerId: req.userId,
            parentId: null
        }).sort({ createdAt: -1 });

        res.json(folders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get folder by ID with children and files
router.get('/:id', async (req, res) => {
    try {
        const folder = await Folder.findOne({
            _id: req.params.id,
            ownerId: req.userId
        });

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        const subfolders = await Folder.find({
            parentId: folder._id,
            ownerId: req.userId
        }).sort({ createdAt: -1 });

        const files = await File.find({
            folderId: folder._id,
            ownerId: req.userId
        }).sort({ createdAt: -1 });

        // Get breadcrumb path
        const breadcrumb = await getBreadcrumb(folder._id, req.userId);

        res.json({
            folder,
            subfolders,
            files,
            breadcrumb
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create folder
router.post('/', async (req, res) => {
    try {
        const { name, parentId } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Folder name is required' });
        }

        let path = '/';
        let validParentId = null;

        if (parentId && parentId !== 'null' && parentId !== 'undefined') {
            const mongoose = require('mongoose');

            if (!mongoose.Types.ObjectId.isValid(parentId)) {
                return res.status(400).json({ error: 'Invalid parent folder ID' });
            }

            const parentFolder = await Folder.findOne({
                _id: parentId,
                ownerId: req.userId
            });

            if (!parentFolder) {
                return res.status(404).json({ error: 'Parent folder not found' });
            }

            path = `${parentFolder.path || '/'}${parentFolder.name}/`;
            validParentId = parentFolder._id;
        }

        const folder = new Folder({
            name,
            parentId: validParentId,
            ownerId: req.userId,
            path
        });

        await folder.save();
        res.status(201).json(folder);
    } catch (error) {
        console.error('Folder creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Rename folder
router.put('/:id', async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Folder name is required' });
        }

        const folder = await Folder.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.userId },
            { name },
            { new: true }
        );

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        res.json(folder);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete folder (cascade delete all children)
router.delete('/:id', async (req, res) => {
    try {
        const folder = await Folder.findOne({
            _id: req.params.id,
            ownerId: req.userId
        });

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        await deleteFolderRecursive(folder._id, req.userId);

        res.json({ message: 'Folder deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate share link
router.post('/:id/share', async (req, res) => {
    try {
        const shareId = generateUUID();

        const folder = await Folder.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.userId },
            { isShared: true, shareId },
            { new: true }
        );

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        res.json({
            message: 'Share link generated',
            shareId: folder.shareId,
            shareUrl: `/public/${folder.shareId}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Revoke share link
router.delete('/:id/share', async (req, res) => {
    try {
        const folder = await Folder.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.userId },
            { isShared: false, shareId: null },
            { new: true }
        );

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        res.json({ message: 'Share link revoked' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper: Get breadcrumb path
async function getBreadcrumb(folderId, userId) {
    const breadcrumb = [];
    let currentId = folderId;

    while (currentId) {
        const folder = await Folder.findOne({ _id: currentId, ownerId: userId });
        if (!folder) break;

        breadcrumb.unshift({ id: folder._id, name: folder.name });
        currentId = folder.parentId;
    }

    return breadcrumb;
}

// Helper: Recursively delete folder and contents
async function deleteFolderRecursive(folderId, userId) {
    const subfolders = await Folder.find({ parentId: folderId, ownerId: userId });

    for (const subfolder of subfolders) {
        await deleteFolderRecursive(subfolder._id, userId);
    }

    await File.deleteMany({ folderId, ownerId: userId });
    await Folder.deleteOne({ _id: folderId, ownerId: userId });
}

module.exports = router;
