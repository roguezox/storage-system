/**
 * Abstract Storage Provider Interface
 * All storage providers must implement these methods
 */
class StorageProvider {
    /**
     * Upload a file to storage
     * @param {string} fileName - Original filename
     * @param {Buffer} buffer - File data
     * @param {string} mimeType - MIME type
     * @param {string} userId - Owner's user ID
     * @returns {Promise<{storageKey: string, size: number}>}
     */
    async upload(fileName, buffer, mimeType, userId) {
        throw new Error('upload() must be implemented by storage provider');
    }

    /**
     * Download a file from storage
     * @param {string} storageKey - Storage reference key
     * @returns {Promise<Buffer>}
     */
    async download(storageKey) {
        throw new Error('download() must be implemented by storage provider');
    }

    /**
     * Delete a file from storage
     * @param {string} storageKey - Storage reference key
     * @returns {Promise<void>}
     */
    async delete(storageKey) {
        throw new Error('delete() must be implemented by storage provider');
    }

    /**
     * Check if a file exists
     * @param {string} storageKey - Storage reference key
     * @returns {Promise<boolean>}
     */
    async exists(storageKey) {
        throw new Error('exists() must be implemented by storage provider');
    }

    /**
     * Get storage provider type
     * @returns {string}
     */
    getType() {
        throw new Error('getType() must be implemented by storage provider');
    }
}

module.exports = StorageProvider;
