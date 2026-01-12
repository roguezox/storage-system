const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');
const path = require('path');
const StorageProvider = require('./StorageProvider');
const logger = require('../utils/logger');

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GOOGLE CLOUD STORAGE PROVIDER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Native Google Cloud Storage integration for scalable file storage.
 *
 * Features:
 * - Native GCS SDK (@google-cloud/storage)
 * - Service account authentication
 * - Multi-region support
 * - Automatic retry with exponential backoff
 * - Signed URLs for secure downloads
 * - Storage class management (Standard, Nearline, Coldline, Archive)
 *
 * Environment Variables:
 * ────────────────────────────────────────────────────────────────────────────
 * GCS_PROJECT_ID       - Google Cloud project ID
 * GCS_BUCKET           - Bucket name (e.g., 'opendrive-production')
 * GCS_KEYFILE          - Path to service account key JSON file (optional)
 * GOOGLE_APPLICATION_CREDENTIALS - Alternative way to specify credentials
 *
 * Authentication Options:
 * ────────────────────────────────────────────────────────────────────────────
 * 1. Service Account Key File:
 *    Set GCS_KEYFILE=/path/to/service-account-key.json
 *
 * 2. Application Default Credentials (ADC):
 *    Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
 *
 * 3. Workload Identity (GKE):
 *    Automatically uses pod's service account if running in GKE
 *
 * 4. Environment variables (for CI/CD):
 *    Set GOOGLE_CLOUD_PROJECT and credentials as base64
 *
 * Setup Instructions:
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. Create GCS bucket:
 *    gcloud storage buckets create gs://opendrive-production \
 *      --location=us-central1 \
 *      --uniform-bucket-level-access
 *
 * 2. Create service account:
 *    gcloud iam service-accounts create opendrive-storage \
 *      --display-name="OpenDrive Storage Service Account"
 *
 * 3. Grant permissions:
 *    gcloud storage buckets add-iam-policy-binding gs://opendrive-production \
 *      --member="serviceAccount:opendrive-storage@PROJECT_ID.iam.gserviceaccount.com" \
 *      --role="roles/storage.objectAdmin"
 *
 * 4. Create and download key:
 *    gcloud iam service-accounts keys create ./gcs-key.json \
 *      --iam-account=opendrive-storage@PROJECT_ID.iam.gserviceaccount.com
 *
 * 5. Set environment variables:
 *    export GCS_PROJECT_ID="your-project-id"
 *    export GCS_BUCKET="opendrive-production"
 *    export GCS_KEYFILE="./gcs-key.json"
 *
 * Pricing (as of 2026):
 * ────────────────────────────────────────────────────────────────────────────
 * Standard Storage:     $0.020/GB/month
 * Nearline Storage:     $0.010/GB/month (30-day minimum)
 * Coldline Storage:     $0.004/GB/month (90-day minimum)
 * Archive Storage:      $0.0012/GB/month (365-day minimum)
 *
 * Network egress:       $0.12/GB (to internet)
 * Class A operations:   $0.05 per 10,000 ops (writes)
 * Class B operations:   $0.004 per 10,000 ops (reads)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
class GCSStorageProvider extends StorageProvider {
    constructor(options = {}) {
        super();

        // Initialize GCS client
        const storageConfig = {
            projectId: options.projectId || process.env.GCS_PROJECT_ID
        };

        // Add keyfile if specified
        if (options.keyFilename || process.env.GCS_KEYFILE) {
            storageConfig.keyFilename = options.keyFilename || process.env.GCS_KEYFILE;
        }
        // Otherwise, uses Application Default Credentials (ADC)

        this.storage = new Storage(storageConfig);
        this.bucketName = options.bucket || process.env.GCS_BUCKET || 'opendrive';
        this.bucket = this.storage.bucket(this.bucketName);

        // Storage class for uploads (Standard, Nearline, Coldline, Archive)
        this.storageClass = options.storageClass || process.env.GCS_STORAGE_CLASS || 'STANDARD';

        logger.info('GCS Storage Provider initialized', {
            component: 'storage',
            operation: 'init',
            projectId: storageConfig.projectId,
            bucket: this.bucketName,
            storageClass: this.storageClass,
            authMethod: storageConfig.keyFilename ? 'service-account-key' : 'ADC'
        });
    }

    /**
     * Generate a unique storage path for the file
     * Format: userId/YYYY/MM/DD/uuid-filename.ext
     *
     * Example: user_abc/2026/01/11/f47ac10b-5886-41ca-8e3f-c8a4e5b9c7d2-vacation.jpg
     */
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

    /**
     * Upload file to Google Cloud Storage
     *
     * @param {string} fileName - Original file name
     * @param {Buffer} buffer - File content as buffer
     * @param {string} mimeType - MIME type (e.g., 'image/jpeg')
     * @param {string} userId - User ID for path organization
     * @returns {Promise<{storageKey: string, size: number}>}
     */
    async upload(fileName, buffer, mimeType, userId) {
        const storageKey = this.generateStorageKey(fileName, userId);
        const file = this.bucket.file(storageKey);

        const startTime = Date.now();

        try {
            // Upload with metadata
            await file.save(buffer, {
                contentType: mimeType,
                metadata: {
                    originalName: fileName,
                    userId: userId,
                    uploadedAt: new Date().toISOString(),
                    storageClass: this.storageClass
                },
                // Enable resumable uploads for files > 5MB
                resumable: buffer.length > 5 * 1024 * 1024,
                // Retry configuration
                retryOptions: {
                    autoRetry: true,
                    maxRetries: 3,
                    retryDelayMultiplier: 2
                }
            });

            const duration = Date.now() - startTime;

            logger.info('File uploaded to GCS', {
                component: 'storage',
                operation: 'gcs_upload',
                bucket: this.bucketName,
                storageKey: storageKey,
                fileName: fileName,
                fileSize: buffer.length,
                contentType: mimeType,
                duration: duration,
                userId: userId
            });

            return {
                storageKey,
                size: buffer.length
            };

        } catch (error) {
            logger.error('Failed to upload file to GCS', {
                component: 'storage',
                operation: 'gcs_upload',
                error: {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                },
                bucket: this.bucketName,
                fileName: fileName,
                userId: userId
            });
            throw new Error(`GCS upload failed: ${error.message}`);
        }
    }

    /**
     * Download file from Google Cloud Storage
     *
     * @param {string} storageKey - GCS object path
     * @returns {Promise<Buffer>} File content as buffer
     */
    async download(storageKey) {
        const file = this.bucket.file(storageKey);
        const startTime = Date.now();

        try {
            // Download file content
            const [buffer] = await file.download();

            const duration = Date.now() - startTime;

            logger.info('File downloaded from GCS', {
                component: 'storage',
                operation: 'gcs_download',
                bucket: this.bucketName,
                storageKey: storageKey,
                fileSize: buffer.length,
                duration: duration
            });

            return buffer;

        } catch (error) {
            logger.error('Failed to download file from GCS', {
                component: 'storage',
                operation: 'gcs_download',
                error: {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                },
                bucket: this.bucketName,
                storageKey: storageKey
            });

            // Provide helpful error message
            if (error.code === 404) {
                throw new Error(`File not found in GCS: ${storageKey}`);
            }
            throw new Error(`GCS download failed: ${error.message}`);
        }
    }

    /**
     * Delete file from Google Cloud Storage
     *
     * @param {string} storageKey - GCS object path
     * @returns {Promise<void>}
     */
    async delete(storageKey) {
        const file = this.bucket.file(storageKey);

        try {
            await file.delete();

            logger.info('File deleted from GCS', {
                component: 'storage',
                operation: 'gcs_delete',
                bucket: this.bucketName,
                storageKey: storageKey
            });

        } catch (error) {
            logger.error('Failed to delete file from GCS', {
                component: 'storage',
                operation: 'gcs_delete',
                error: {
                    message: error.message,
                    code: error.code
                },
                bucket: this.bucketName,
                storageKey: storageKey
            });

            // Don't throw on 404 (already deleted)
            if (error.code !== 404) {
                throw new Error(`GCS delete failed: ${error.message}`);
            }
        }
    }

    /**
     * Check if file exists in Google Cloud Storage
     *
     * @param {string} storageKey - GCS object path
     * @returns {Promise<boolean>}
     */
    async exists(storageKey) {
        try {
            const file = this.bucket.file(storageKey);
            const [exists] = await file.exists();
            return exists;
        } catch (error) {
            logger.error('Failed to check file existence in GCS', {
                component: 'storage',
                operation: 'gcs_exists',
                error: { message: error.message },
                storageKey: storageKey
            });
            return false;
        }
    }

    /**
     * Generate a signed URL for temporary public access
     *
     * @param {string} storageKey - GCS object path
     * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
     * @returns {Promise<string>} Signed URL
     */
    async getSignedUrl(storageKey, expiresIn = 3600) {
        try {
            const file = this.bucket.file(storageKey);

            const [url] = await file.getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + expiresIn * 1000
            });

            logger.debug('Generated signed URL for GCS file', {
                component: 'storage',
                operation: 'gcs_signed_url',
                storageKey: storageKey,
                expiresIn: expiresIn
            });

            return url;

        } catch (error) {
            logger.error('Failed to generate signed URL', {
                component: 'storage',
                operation: 'gcs_signed_url',
                error: { message: error.message },
                storageKey: storageKey
            });
            throw new Error(`Failed to generate signed URL: ${error.message}`);
        }
    }

    /**
     * Get file metadata from GCS
     *
     * @param {string} storageKey - GCS object path
     * @returns {Promise<object>} File metadata
     */
    async getMetadata(storageKey) {
        try {
            const file = this.bucket.file(storageKey);
            const [metadata] = await file.getMetadata();

            return {
                name: metadata.name,
                size: parseInt(metadata.size),
                contentType: metadata.contentType,
                updated: metadata.updated,
                created: metadata.timeCreated,
                storageClass: metadata.storageClass,
                customMetadata: metadata.metadata
            };

        } catch (error) {
            logger.error('Failed to get file metadata from GCS', {
                component: 'storage',
                operation: 'gcs_metadata',
                error: { message: error.message },
                storageKey: storageKey
            });
            throw new Error(`Failed to get metadata: ${error.message}`);
        }
    }

    /**
     * Move file to different storage class (for cost optimization)
     *
     * @param {string} storageKey - GCS object path
     * @param {string} storageClass - New storage class (STANDARD, NEARLINE, COLDLINE, ARCHIVE)
     * @returns {Promise<void>}
     */
    async changeStorageClass(storageKey, storageClass) {
        try {
            const file = this.bucket.file(storageKey);
            await file.setStorageClass(storageClass);

            logger.info('Changed file storage class in GCS', {
                component: 'storage',
                operation: 'gcs_change_class',
                storageKey: storageKey,
                newStorageClass: storageClass
            });

        } catch (error) {
            logger.error('Failed to change storage class in GCS', {
                component: 'storage',
                operation: 'gcs_change_class',
                error: { message: error.message },
                storageKey: storageKey,
                storageClass: storageClass
            });
            throw new Error(`Failed to change storage class: ${error.message}`);
        }
    }

    /**
     * Get storage provider type
     * @returns {string}
     */
    getType() {
        return 'gcs';
    }
}

module.exports = GCSStorageProvider;
