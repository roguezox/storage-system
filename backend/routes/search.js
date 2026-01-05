const express = require('express');
const File = require('../models/File');
const Folder = require('../models/Folder');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Unified search endpoint with auto-complete support
router.get('/', async (req, res) => {
    try {
        const { q, type } = req.query;

        // Allow single character searches for auto-complete
        if (!q || q.trim().length < 1) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Use regex for partial matching and auto-complete
        const searchRegex = new RegExp(q.trim(), 'i'); // Case-insensitive

        const searchQuery = {
            ownerId: req.userId,
            deletedAt: null,
            $or: [
                { name: searchRegex },
                { originalName: searchRegex }
            ]
        };

        let results = { files: [], folders: [] };

        // Search files
        if (!type || type === 'all' || type === 'files') {
            results.files = await File.find(searchQuery)
                .sort({ name: 1 }) // Sort alphabetically
                .limit(type === 'files' ? 50 : 25)
                .populate('folderId', 'name path');
        }

        // Search folders
        if (!type || type === 'all' || type === 'folders') {
            const folderQuery = {
                ownerId: req.userId,
                deletedAt: null,
                name: searchRegex
            };

            results.folders = await Folder.find(folderQuery)
                .sort({ name: 1 }) // Sort alphabetically
                .limit(type === 'folders' ? 50 : 25);
        }

        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
