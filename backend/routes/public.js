const express = require('express');
const Folder = require('../models/Folder');
const File = require('../models/File');

const router = express.Router();

// Get shared resource by shareId (no auth required)
router.get('/:shareId', async (req, res) => {
    try {
        const { shareId } = req.params;

        // First try to find a folder with this shareId
        const folder = await Folder.findOne({ shareId, isShared: true });

        if (folder) {
            // Get subfolders and files in this folder
            const subfolders = await Folder.find({
                parentId: folder._id,
                isShared: true
            }).select('name createdAt shareId');

            const files = await File.find({
                folderId: folder._id
            }).select('name url mimeType size createdAt shareId isShared');

            return res.json({
                type: 'folder',
                data: {
                    id: folder._id,
                    name: folder.name,
                    createdAt: folder.createdAt,
                    subfolders,
                    files
                }
            });
        }

        // Try to find a file with this shareId
        const file = await File.findOne({ shareId, isShared: true });

        if (file) {
            return res.json({
                type: 'file',
                data: {
                    id: file._id,
                    name: file.name,
                    url: file.url,
                    mimeType: file.mimeType,
                    size: file.size,
                    createdAt: file.createdAt
                }
            });
        }

        // Nothing found
        res.status(404).json({ error: 'Shared resource not found or link has been revoked' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
