const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    originalName: {
        type: String,
        required: true
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
    url: {
        type: String,
        required: true
    },
    mimeType: {
        type: String,
        default: 'application/octet-stream'
    },
    size: {
        type: Number,
        default: 0
    },
    isShared: {
        type: Boolean,
        default: false
    },
    shareId: {
        type: String,
        default: null,
        index: true  // Index for fast lookups, but not unique
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('File', fileSchema);
