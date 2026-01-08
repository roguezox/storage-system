const express = require('express');
const Folder = require('../models/Folder');
const File = require('../models/File');
const { getStorage } = require('../storage');
const logger = require('../utils/logger');

const router = express.Router();

// Get shared folder or file by shareId
router.get('/:shareId', async (req, res) => {
    try {
        // Check if it's a shared folder
        const folder = await Folder.findOne({
            shareId: req.params.shareId,
            isShared: true
        });

        if (folder) {
            const subfolders = await Folder.find({
                parentId: folder._id
            }).select('_id name createdAt');

            const files = await File.find({
                folderId: folder._id
            });

            logger.info('Public folder accessed', {
                component: 'public',
                operation: 'view_shared_folder',
                shareId: req.params.shareId,
                folderId: folder._id.toString(),
                folderName: folder.name,
                ownerId: folder.ownerId.toString(),
                subfolderCount: subfolders.length,
                fileCount: files.length,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });

            return res.json({
                type: 'folder',
                folder: {
                    _id: folder._id,
                    name: folder.name,
                    createdAt: folder.createdAt
                },
                subfolders,
                files,
                rootShareId: req.params.shareId
            });
        }

        // Check if it's a shared file
        const file = await File.findOne({
            shareId: req.params.shareId,
            isShared: true
        });

        if (file) {
            logger.info('Public file accessed', {
                component: 'public',
                operation: 'view_shared_file',
                shareId: req.params.shareId,
                fileId: file._id.toString(),
                fileName: file.originalName,
                ownerId: file.ownerId.toString(),
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });

            return res.json({
                type: 'file',
                file: {
                    _id: file._id,
                    name: file.name,
                    originalName: file.originalName,
                    mimeType: file.mimeType,
                    size: file.size,
                    createdAt: file.createdAt
                }
            });
        }

        res.status(404).json({ error: 'Shared content not found' });
    } catch (error) {
        logger.error('Public access error', {
            component: 'public',
            operation: 'access_shared_content',
            shareId: req.params.shareId,
            error: {
                message: error.message,
                stack: error.stack
            },
            ipAddress: req.ip
        });
        res.status(500).json({ error: error.message });
    }
});

// Navigate into subfolder within a shared folder
router.get('/:shareId/folder/:folderId', async (req, res) => {
    try {
        const { shareId, folderId } = req.params;

        // Verify the root folder is shared
        const rootFolder = await Folder.findOne({
            shareId: shareId,
            isShared: true
        });

        if (!rootFolder) {
            return res.status(404).json({ error: 'Shared folder not found' });
        }

        // Check if the requested folder is a descendant of the shared folder
        const isDescendant = await checkIsDescendant(folderId, rootFolder._id);
        if (!isDescendant && folderId !== rootFolder._id.toString()) {
            logger.warn('Public access denied - invalid descendant', {
                component: 'public',
                operation: 'access_denied',
                shareId: shareId,
                requestedFolderId: folderId,
                reason: 'not_descendant_of_shared_folder',
                ipAddress: req.ip
            });
            return res.status(403).json({ error: 'Access denied' });
        }

        const folder = await Folder.findById(folderId);
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        const subfolders = await Folder.find({
            parentId: folder._id
        }).select('_id name createdAt');

        const files = await File.find({
            folderId: folder._id
        });

        // Build breadcrumb from this folder up to the shared root
        const breadcrumb = await getBreadcrumbToRoot(folder._id, rootFolder._id);

        res.json({
            type: 'folder',
            folder: {
                _id: folder._id,
                name: folder.name,
                createdAt: folder.createdAt,
                parentId: folder.parentId
            },
            subfolders,
            files,
            breadcrumb,
            rootShareId: shareId,
            rootFolderId: rootFolder._id
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Download file within a shared folder
router.get('/:shareId/file/:fileId/download', async (req, res) => {
    try {
        const { shareId, fileId } = req.params;

        // Verify the root folder is shared
        const rootFolder = await Folder.findOne({
            shareId: shareId,
            isShared: true
        });

        if (!rootFolder) {
            return res.status(404).json({ error: 'Shared folder not found' });
        }

        const file = await File.findById(fileId);
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Check if file's folder is within the shared folder tree
        const isDescendant = await checkIsDescendant(file.folderId.toString(), rootFolder._id);
        if (!isDescendant && file.folderId.toString() !== rootFolder._id.toString()) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Download from storage provider
        const storage = getStorage();
        const buffer = await storage.download(file.storageKey);

        logger.info('Public file downloaded from shared folder', {
            component: 'public',
            operation: 'download_shared_file',
            shareId: shareId,
            fileId: file._id.toString(),
            fileName: file.originalName,
            fileSize: buffer.length,
            ownerId: file.ownerId.toString(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.set({
            'Content-Type': file.mimeType,
            'Content-Disposition': `attachment; filename="${file.originalName || file.name}"`,
            'Content-Length': buffer.length
        });

        res.send(buffer);
    } catch (error) {
        logger.error('Public file download failed', {
            component: 'public',
            operation: 'download_shared_file',
            shareId: req.params.shareId,
            fileId: req.params.fileId,
            error: {
                message: error.message,
                stack: error.stack
            },
            ipAddress: req.ip
        });
        res.status(500).json({ error: error.message });
    }
});

// Download shared file directly
router.get('/:shareId/download', async (req, res) => {
    try {
        const file = await File.findOne({
            shareId: req.params.shareId,
            isShared: true
        });

        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Download from storage provider
        const storage = getStorage();
        const buffer = await storage.download(file.storageKey);

        logger.info('Public file downloaded directly', {
            component: 'public',
            operation: 'download_shared_file_direct',
            shareId: req.params.shareId,
            fileId: file._id.toString(),
            fileName: file.originalName,
            fileSize: buffer.length,
            ownerId: file.ownerId.toString(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.set({
            'Content-Type': file.mimeType,
            'Content-Disposition': `attachment; filename="${file.originalName || file.name}"`,
            'Content-Length': buffer.length
        });

        res.send(buffer);
    } catch (error) {
        logger.error('Public file download failed', {
            component: 'public',
            operation: 'download_shared_file_direct',
            shareId: req.params.shareId,
            error: {
                message: error.message,
                stack: error.stack
            },
            ipAddress: req.ip
        });
        res.status(500).json({ error: error.message });
    }
});

// Helper: Check if a folder is a descendant of another folder
async function checkIsDescendant(folderId, ancestorId) {
    let currentId = folderId;
    const visited = new Set();

    while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);

        if (currentId === ancestorId.toString()) {
            return true;
        }

        const folder = await Folder.findById(currentId);
        if (!folder || !folder.parentId) break;
        currentId = folder.parentId.toString();
    }

    return false;
}

// Helper: Build breadcrumb from folder up to shared root
async function getBreadcrumbToRoot(folderId, rootId) {
    const breadcrumb = [];
    let currentId = folderId;

    while (currentId) {
        const folder = await Folder.findById(currentId);
        if (!folder) break;

        breadcrumb.unshift({ _id: folder._id, name: folder.name });

        if (currentId.toString() === rootId.toString()) break;
        currentId = folder.parentId;
    }

    return breadcrumb;
}

module.exports = router;
