const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        default: null
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    path: {
        type: String,
        default: '/'
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

// Virtual for getting child folders
folderSchema.virtual('children', {
    ref: 'Folder',
    localField: '_id',
    foreignField: 'parentId'
});

// Virtual for getting files in this folder
folderSchema.virtual('files', {
    ref: 'File',
    localField: '_id',
    foreignField: 'folderId'
});

folderSchema.set('toObject', { virtuals: true });
folderSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Folder', folderSchema);
