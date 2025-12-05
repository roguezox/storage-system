const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Folder = require('../models/Folder');
const File = require('../models/File');
const auth = require('../middleware/auth');

const router = express.Router();

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

// Get sub-folders only
router.get('/:id/subfolders', async (req, res) => {
    try {
        const subfolders = await Folder.find({
            parentId: req.params.id,
            ownerId: req.userId
        }).sort({ createdAt: -1 });

        res.json(subfolders);
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

            // Validate parentId is a valid ObjectId
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

        // Recursively delete all subfolders and files
        await deleteFolderRecursive(folder._id, req.userId);

        res.json({ message: 'Folder deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate share link
router.post('/:id/share', async (req, res) => {
    try {
        const shareId = uuidv4();

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

// Helper function to delete folder and all its contents recursively
async function deleteFolderRecursive(folderId, ownerId) {
    // Delete all files in this folder
    await File.deleteMany({ folderId, ownerId });

    // Find all subfolders
    const subfolders = await Folder.find({ parentId: folderId, ownerId });

    // Recursively delete each subfolder
    for (const subfolder of subfolders) {
        await deleteFolderRecursive(subfolder._id, ownerId);
    }

    // Delete the folder itself
    await Folder.deleteOne({ _id: folderId, ownerId });
}

// Helper function to get breadcrumb path
async function getBreadcrumb(folderId, ownerId) {
    const breadcrumb = [];
    let currentFolder = await Folder.findOne({ _id: folderId, ownerId });

    while (currentFolder) {
        breadcrumb.unshift({
            id: currentFolder._id,
            name: currentFolder.name
        });

        if (currentFolder.parentId) {
            currentFolder = await Folder.findOne({ _id: currentFolder.parentId, ownerId });
        } else {
            currentFolder = null;
        }
    }

    return breadcrumb;
}

module.exports = router;
