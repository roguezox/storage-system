const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const path = require('path');
const StorageProvider = require('./StorageProvider');
const logger = require('../utils/logger');

/**
 * S3-Compatible Storage Provider
 * Works with AWS S3, MinIO, Backblaze B2, DigitalOcean Spaces, etc.
 */
class S3StorageProvider extends StorageProvider {
    constructor(options = {}) {
        super();

        const endpoint = options.endpoint || process.env.S3_ENDPOINT;

        this.client = new S3Client({
            region: options.region || process.env.S3_REGION || 'us-east-1',
            endpoint: endpoint || undefined,
            forcePathStyle: !!endpoint, // Required for MinIO
            credentials: {
                accessKeyId: options.accessKey || process.env.S3_ACCESS_KEY,
                secretAccessKey: options.secretKey || process.env.S3_SECRET_KEY
            }
        });

        this.bucket = options.bucket || process.env.S3_BUCKET || 'drive';
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

    async upload(fileName, buffer, mimeType, userId) {
        const storageKey = this.generateStorageKey(fileName, userId);

        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: storageKey,
            Body: buffer,
            ContentType: mimeType
        }));

        logger.debug('File stored in S3-compatible storage', {
            component: 'storage',
            operation: 's3_upload',
            bucket: this.bucket,
            storageKey: storageKey,
            fileSize: buffer.length,
            contentType: mimeType
        });

        return {
            storageKey,
            size: buffer.length
        };
    }

    async download(storageKey) {
        const response = await this.client.send(new GetObjectCommand({
            Bucket: this.bucket,
            Key: storageKey
        }));

        // Convert stream to buffer
        const chunks = [];
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        logger.debug('File retrieved from S3-compatible storage', {
            component: 'storage',
            operation: 's3_download',
            bucket: this.bucket,
            storageKey: storageKey,
            fileSize: buffer.length
        });

        return buffer;
    }

    async delete(storageKey) {
        await this.client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: storageKey
        }));

        logger.debug('File deleted from S3-compatible storage', {
            component: 'storage',
            operation: 's3_delete',
            bucket: this.bucket,
            storageKey: storageKey
        });
    }

    async exists(storageKey) {
        try {
            await this.client.send(new HeadObjectCommand({
                Bucket: this.bucket,
                Key: storageKey
            }));
            return true;
        } catch (err) {
            if (err.name === 'NotFound') return false;
            throw err;
        }
    }

    getType() {
        return 's3';
    }
}

module.exports = S3StorageProvider;
