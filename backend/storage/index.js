const LocalStorageProvider = require('./LocalStorageProvider');
const S3StorageProvider = require('./S3StorageProvider');
const GCSStorageProvider = require('./GCSStorageProvider');

let storageInstance = null;

/**
 * Get the configured storage provider instance (singleton)
 * @returns {StorageProvider}
 */
function getStorage() {
    if (storageInstance) {
        return storageInstance;
    }

    const provider = process.env.STORAGE_PROVIDER || 'local';

    switch (provider.toLowerCase()) {
        case 'gcs':
        case 'google':
        case 'google-cloud':
            storageInstance = new GCSStorageProvider();
            console.log('📦 Using Google Cloud Storage');
            break;
        case 's3':
        case 'minio':
            storageInstance = new S3StorageProvider();
            console.log('📦 Using S3-compatible storage');
            break;
        case 'local':
        default:
            storageInstance = new LocalStorageProvider();
            console.log(`📦 Using local storage at ${process.env.STORAGE_PATH || './uploads'}`);
            break;
    }

    return storageInstance;
}

/**
 * Reset storage instance (useful for testing)
 */
function resetStorage() {
    storageInstance = null;
}

module.exports = { getStorage, resetStorage };
