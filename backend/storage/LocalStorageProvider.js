const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const StorageProvider = require('./StorageProvider');
const logger = require('../utils/logger');

/**
 * Local Filesystem Storage Provider
 * Stores files on the local disk - ideal for self-hosted deployments
 */
class LocalStorageProvider extends StorageProvider {
    constructor(options = {}) {
        super();
        this.basePath = options.basePath || process.env.STORAGE_PATH || './uploads';
    }

    async ensureDir(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (err) {
            if (err.code !== 'EEXIST') throw err;
        }
    }

    generateStorageKey(fileName, userId) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const uniqueId = crypto.randomUUID();
        const ext = path.extname(fileName);
        const safeName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9-_]/g, '_');

        return `${userId}/${year}/${month}/${day}/${uniqueId}-${safeName}${ext}`;
    }

    getFullPath(storageKey) {
        return path.join(this.basePath, storageKey);
    }

    async upload(fileName, buffer, mimeType, userId) {
        const storageKey = this.generateStorageKey(fileName, userId);
        const fullPath = this.getFullPath(storageKey);
        const dirPath = path.dirname(fullPath);

        await this.ensureDir(dirPath);
        await fs.writeFile(fullPath, buffer);

        logger.debug('File stored in local storage', {
            component: 'storage',
            operation: 'local_upload',
            storageKey: storageKey,
            fileSize: buffer.length,
            fullPath: fullPath
        });

        return {
            storageKey,
            size: buffer.length
        };
    }

    async download(storageKey) {
        const fullPath = this.getFullPath(storageKey);
        const buffer = await fs.readFile(fullPath);

        logger.debug('File retrieved from local storage', {
            component: 'storage',
            operation: 'local_download',
            storageKey: storageKey,
            fileSize: buffer.length,
            fullPath: fullPath
        });

        return buffer;
    }

    async delete(storageKey) {
        const fullPath = this.getFullPath(storageKey);
        try {
            await fs.unlink(fullPath);

            logger.debug('File deleted from local storage', {
                component: 'storage',
                operation: 'local_delete',
                storageKey: storageKey,
                fullPath: fullPath
            });
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
    }

    async exists(storageKey) {
        const fullPath = this.getFullPath(storageKey);
        try {
            await fs.access(fullPath);
            return true;
        } catch {
            return false;
        }
    }

    getType() {
        return 'local';
    }
}

module.exports = LocalStorageProvider;
