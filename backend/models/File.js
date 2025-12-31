const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    originalName: {
        type: String
    },
    folderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        required: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Storage key - reference to file in storage backend
    storageKey: {
        type: String,
        required: true
    },
    // Which storage provider holds this file
    storageProvider: {
        type: String,
        default: 'local'
    },
    mimeType: {
        type: String
    },
    size: {
        type: Number
    },
    isShared: {
        type: Boolean,
        default: false
    },
    shareId: {
        type: String,
        default: null,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('File', fileSchema);

