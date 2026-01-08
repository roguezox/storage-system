const express = require('express');
const crypto = require('crypto');
const Folder = require('../models/Folder');
const File = require('../models/File');
const auth = require('../middleware/auth');
const { getStorage } = require('../storage');
const logger = require('../utils/logger');

const router = express.Router();

// Generate UUID using built-in crypto
const generateUUID = () => crypto.randomUUID();

// All routes require authentication
router.use(auth);

// Get user stats (folders count, storage used)
router.get('/stats/summary', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const userObjectId = new mongoose.Types.ObjectId(req.userId);

        // Count total folders (excluding deleted)
        const totalFolders = await Folder.countDocuments({ ownerId: req.userId, deletedAt: null });

        // Calculate total storage used (sum of all file sizes, excluding deleted)
        const storageResult = await File.aggregate([
            { $match: { ownerId: userObjectId, deletedAt: null } },
            { $group: { _id: null, totalSize: { $sum: '$size' } } }
        ]);

        const totalFiles = await File.countDocuments({ ownerId: req.userId, deletedAt: null });
        const storageUsed = storageResult.length > 0 ? storageResult[0].totalSize : 0;

        res.json({
            totalFolders,
            totalFiles,
            storageUsed
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all root folders
router.get('/', async (req, res) => {
    try {
        const folders = await Folder.find({
            ownerId: req.userId,
            parentId: null,
            deletedAt: null
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
            ownerId: req.userId,
            deletedAt: null
        });

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        const subfolders = await Folder.find({
            parentId: folder._id,
            ownerId: req.userId,
            deletedAt: null
        }).sort({ createdAt: -1 });

        const files = await File.find({
            folderId: folder._id,
            ownerId: req.userId,
            deletedAt: null
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

        logger.info('Folder created', {
            component: 'folders',
            operation: 'create',
            userId: req.userId.toString(),
            folderId: folder._id.toString(),
            folderName: name,
            parentId: validParentId ? validParentId.toString() : null,
            path: path
        });

        res.status(201).json(folder);
    } catch (error) {
        logger.error('Folder creation failed', {
            component: 'folders',
            operation: 'create',
            userId: req.userId.toString(),
            folderName: req.body.name,
            parentId: req.body.parentId,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
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

        const oldFolder = await Folder.findOne({ _id: req.params.id, ownerId: req.userId, deletedAt: null });
        const oldName = oldFolder ? oldFolder.name : 'unknown';

        const folder = await Folder.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.userId, deletedAt: null },
            { name },
            { new: true }
        );

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        logger.info('Folder renamed', {
            component: 'folders',
            operation: 'rename',
            userId: req.userId.toString(),
            folderId: folder._id.toString(),
            oldName: oldName,
            newName: name
        });

        res.json(folder);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete folder (soft delete - cascade to all children)
router.delete('/:id', async (req, res) => {
    try {
        const folder = await Folder.findOne({
            _id: req.params.id,
            ownerId: req.userId,
            deletedAt: null
        });

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        await softDeleteFolderRecursive(folder._id, req.userId);

        logger.info('Folder moved to trash', {
            component: 'folders',
            operation: 'soft_delete',
            userId: req.userId.toString(),
            folderId: folder._id.toString(),
            folderName: folder.name,
            cascade: true
        });

        res.json({ message: 'Folder moved to trash' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate share link
router.post('/:id/share', async (req, res) => {
    try {
        const shareId = generateUUID();

        const folder = await Folder.findOneAndUpdate(
            { _id: req.params.id, ownerId: req.userId, deletedAt: null },
            { isShared: true, shareId },
            { new: true }
        );

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        logger.info('Folder share link generated', {
            component: 'folders',
            operation: 'generate_share',
            userId: req.userId.toString(),
            folderId: folder._id.toString(),
            folderName: folder.name,
            shareId: shareId,
            shareUrl: `/public/${shareId}`
        });

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
            { _id: req.params.id, ownerId: req.userId, deletedAt: null },
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
        const folder = await Folder.findOne({ _id: currentId, ownerId: userId, deletedAt: null });
        if (!folder) break;

        breadcrumb.unshift({ id: folder._id, name: folder.name });
        currentId = folder.parentId;
    }

    return breadcrumb;
}

// Helper: Recursively soft delete folder and contents
async function softDeleteFolderRecursive(folderId, userId) {
    const now = new Date();
    const subfolders = await Folder.find({
        parentId: folderId,
        ownerId: userId,
        deletedAt: null
    });

    for (const subfolder of subfolders) {
        await softDeleteFolderRecursive(subfolder._id, userId);
    }

    await File.updateMany(
        { folderId, ownerId: userId, deletedAt: null },
        { deletedAt: now }
    );
    await Folder.updateOne(
        { _id: folderId, ownerId: userId },
        { deletedAt: now }
    );
}

// Helper: Recursively permanently delete folder and contents (for trash cleanup)
async function permanentDeleteFolderRecursive(folderId, userId) {
    const subfolders = await Folder.find({
        parentId: folderId,
        ownerId: userId
    });

    for (const subfolder of subfolders) {
        await permanentDeleteFolderRecursive(subfolder._id, userId);
    }

    // Delete files from storage
    const files = await File.find({ folderId, ownerId: userId });
    const storage = getStorage();

    for (const file of files) {
        try {
            await storage.delete(file.storageKey);
        } catch (err) {
            logger.warn('Failed to delete file from storage', {
                component: 'folders',
                operation: 'permanent_delete_recursive',
                fileId: file._id.toString(),
                storageKey: file.storageKey,
                error: {
                    message: err.message
                }
            });
        }
    }

    await File.deleteMany({ folderId, ownerId: userId });
    await Folder.deleteOne({ _id: folderId, ownerId: userId });
}

// Helper: Recursively restore folder and contents from trash
async function restoreFolderRecursive(folderId, userId) {
    await Folder.updateOne(
        { _id: folderId, ownerId: userId },
        { deletedAt: null }
    );

    await File.updateMany(
        { folderId, ownerId: userId, deletedAt: { $ne: null } },
        { deletedAt: null }
    );

    const subfolders = await Folder.find({
        parentId: folderId,
        ownerId: userId,
        deletedAt: { $ne: null }
    });

    for (const subfolder of subfolders) {
        await restoreFolderRecursive(subfolder._id, userId);
    }
}

// Trash Management Endpoints

// Get all trashed folders
router.get('/trash/list', async (req, res) => {
    try {
        const folders = await Folder.find({
            ownerId: req.userId,
            deletedAt: { $ne: null }
        }).sort({ deletedAt: -1 });

        res.json(folders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Restore folder from trash
router.post('/:id/restore', async (req, res) => {
    try {
        const folder = await Folder.findOne({
            _id: req.params.id,
            ownerId: req.userId,
            deletedAt: { $ne: null }
        });

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found in trash' });
        }

        await restoreFolderRecursive(folder._id, req.userId);

        logger.info('Folder restored from trash', {
            component: 'folders',
            operation: 'restore',
            userId: req.userId.toString(),
            folderId: folder._id.toString(),
            folderName: folder.name,
            cascade: true
        });

        res.json({ message: 'Folder restored successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Permanently delete folder
router.delete('/:id/permanent', async (req, res) => {
    try {
        const folder = await Folder.findOne({
            _id: req.params.id,
            ownerId: req.userId,
            deletedAt: { $ne: null }
        });

        if (!folder) {
            return res.status(404).json({ error: 'Folder not found in trash' });
        }

        await permanentDeleteFolderRecursive(folder._id, req.userId);

        logger.info('Folder permanently deleted', {
            component: 'folders',
            operation: 'permanent_delete',
            userId: req.userId.toString(),
            folderId: folder._id.toString(),
            folderName: folder.name,
            cascade: true
        });

        res.json({ message: 'Folder permanently deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Empty entire trash (folders only)
router.post('/trash/empty', async (req, res) => {
    try {
        const folders = await Folder.find({
            ownerId: req.userId,
            deletedAt: { $ne: null },
            parentId: null // Only get root-level deleted folders
        });

        let deletedCount = 0;
        for (const folder of folders) {
            await permanentDeleteFolderRecursive(folder._id, req.userId);
            deletedCount++;
        }

        res.json({
            message: 'Folder trash emptied successfully',
            deletedCount: deletedCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
