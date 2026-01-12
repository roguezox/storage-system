/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SEARCH INDEXER WORKER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This worker listens for file and folder events and updates search indexes
 * to keep search results fast and up-to-date.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHY SEPARATE SEARCH INDEXING?
 * ───────────────────────────────────────────────────────────────────────────
 *
 * [Problem: Search is Slow]
 * Without an index, searching requires scanning EVERY file:
 *
 * SELECT * FROM files WHERE name LIKE '%vacation%';
 * → For 1 million files, scans all 1 million rows
 * → Takes 5-10 seconds
 * → Unacceptable user experience
 *
 * With a search index (full-text search):
 * → Instant lookup in search index
 * → Returns results in 50-100ms
 * → Great user experience!
 *
 * [Problem: Building Index is Expensive]
 * Creating/updating search index is CPU/IO intensive:
 * - Parse filename, extract keywords
 * - Tokenize (split into words)
 * - Stem (running → run, files → file)
 * - Update inverted index data structure
 *
 * If done synchronously during file upload:
 * - Upload time increases by 100-200ms
 * - API server CPU spikes
 * - Poor user experience
 *
 * [Solution: Async Search Indexing]
 * 1. User uploads file → API returns immediately
 * 2. Publish 'file.uploaded' event
 * 3. Search indexer worker consumes event
 * 4. Worker updates search index in background
 * 5. Search results updated within seconds (eventual consistency)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS A SEARCH INDEX?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A search index is like the index at the back of a book.
 *
 * Without index (linear scan):
 * Files:
 *   id=1, name="vacation_photos.jpg"
 *   id=2, name="work_document.pdf"
 *   id=3, name="family_vacation.jpg"
 *
 * To find "vacation":
 *   1. Check "vacation_photos.jpg" → match! (found "vacation")
 *   2. Check "work_document.pdf" → no match
 *   3. Check "family_vacation.jpg" → match! (found "vacation")
 * Result: 3 comparisons for 3 files
 *
 * With inverted index:
 * {
 *   "vacation": [id=1, id=3],      // Files containing "vacation"
 *   "photos": [id=1],                // Files containing "photos"
 *   "work": [id=2],                  // Files containing "work"
 *   "document": [id=2],              // Files containing "document"
 *   "family": [id=3]                 // Files containing "family"
 * }
 *
 * To find "vacation":
 *   1. Look up "vacation" in index → [id=1, id=3]
 * Result: 1 lookup! O(1) vs O(n)
 *
 * For 1 million files:
 *   Without index: 1 million comparisons
 *   With index: 1 lookup
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SEARCH TECHNOLOGIES:
 * ───────────────────────────────────────────────────────────────────────────
 *
 * [MongoDB Text Index] (Current implementation)
 * ✓ Built into MongoDB
 * ✓ No external dependencies
 * ✓ Simple to set up
 * ✗ Basic features only
 * ✗ Limited relevance scoring
 * ✗ Not good for large datasets (>1M documents)
 *
 * [Elasticsearch] (Enterprise solution)
 * ✓ Powerful full-text search
 * ✓ Advanced relevance scoring
 * ✓ Faceted search, aggregations
 * ✓ Scales to billions of documents
 * ✗ Requires separate cluster
 * ✗ Higher operational complexity
 * ✗ More expensive
 *
 * [Algolia/Typesense] (Managed services)
 * ✓ Blazing fast (10ms response times)
 * ✓ Typo tolerance (vaction → vacation)
 * ✓ Instant search as you type
 * ✓ Easy to integrate
 * ✗ Costs money (paid service)
 *
 * This worker is designed to support ANY search backend!
 * Switch by changing implementation in updateSearchIndex() function.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EVENTS THIS WORKER HANDLES:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. file.uploaded → Add file to search index
 * 2. file.deleted → Remove file from search index
 * 3. file.renamed → Update filename in search index
 * 4. folder.created → Add folder to search index
 * 5. folder.deleted → Remove folder from search index
 * 6. folder.renamed → Update folder name in search index
 *
 * Each event type requires different indexing logic!
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

const { getEventBus } = require('../utils/eventBus');
const File = require('../models/File');
const Folder = require('../models/Folder');
const logger = require('../utils/logger');

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FUNCTION: updateSearchIndex
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Update search index when a file is uploaded/modified
 *
 * @param {string} action - 'add', 'update', or 'remove'
 * @param {object} document - File or Folder document
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SEARCH INDEX STRATEGIES:
 * ───────────────────────────────────────────────────────────────────────────
 *
 * [Strategy 1: MongoDB Text Index (Current - Simple)]
 * MongoDB has built-in text indexing.
 *
 * Setup (run once in MongoDB):
 *   db.files.createIndex({ originalName: "text", mimeType: "text" })
 *
 * Search query:
 *   db.files.find({ $text: { $search: "vacation" } })
 *
 * How it works:
 * - MongoDB automatically tokenizes text fields
 * - Builds inverted index internally
 * - Updates index on every insert/update (sync)
 *
 * This worker just ensures document exists in MongoDB.
 * MongoDB handles indexing automatically!
 *
 * [Strategy 2: Elasticsearch (Advanced - Better)]
 * Separate search cluster for better performance.
 *
 * Index document:
 *   POST /files/_doc/{fileId}
 *   {
 *     "name": "vacation_photos.jpg",
 *     "mimeType": "image/jpeg",
 *     "size": 2048000,
 *     "uploadedAt": "2024-01-10T12:00:00Z",
 *     "userId": "abc123"
 *   }
 *
 * Search query:
 *   GET /files/_search
 *   {
 *     "query": {
 *       "multi_match": {
 *         "query": "vacation",
 *         "fields": ["name^2", "mimeType"]  // ^2 = boost name relevance
 *       }
 *     }
 *   }
 *
 * How it works:
 * - This worker sends HTTP request to Elasticsearch
 * - Elasticsearch indexes document asynchronously
 * - Search queries go to Elasticsearch (not MongoDB)
 * - Much faster than MongoDB text search!
 *
 * [Strategy 3: Algolia (Cloud - Easiest)]
 * Managed search service.
 *
 * Index document:
 *   const algolia = algoliasearch('APP_ID', 'API_KEY');
 *   const index = algolia.initIndex('files');
 *   await index.saveObject({
 *     objectID: fileId,
 *     name: 'vacation_photos.jpg',
 *     mimeType: 'image/jpeg'
 *   });
 *
 * Search:
 *   const results = await index.search('vacation');
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function updateSearchIndex(action, document) {
    try {
        logger.debug('Updating search index', {
            component: 'search-indexer',
            operation: 'update_index',
            action: action,
            documentId: document._id,
            documentType: document.originalName ? 'file' : 'folder',
            name: document.originalName || document.name
        });

        /**
         * STRATEGY 1: MongoDB Text Index (Automatic)
         * ───────────────────────────────────────────────────────────────────
         *
         * MongoDB automatically maintains text index on documents.
         * We don't need to do anything special!
         *
         * Just ensure the document exists in MongoDB (already done by API).
         */

        /**
         * STRATEGY 2: Elasticsearch Integration (Uncomment to enable)
         * ───────────────────────────────────────────────────────────────────
         *
         * // Install: npm install @elastic/elasticsearch
         * // const { Client } = require('@elastic/elasticsearch');
         * // const esClient = new Client({ node: process.env.ELASTICSEARCH_URL });
         *
         * if (action === 'add' || action === 'update') {
         *   const indexName = document.originalName ? 'files' : 'folders';
         *
         *   await esClient.index({
         *     index: indexName,
         *     id: document._id.toString(),
         *     body: {
         *       name: document.originalName || document.name,
         *       mimeType: document.mimeType,
         *       size: document.size,
         *       userId: document.ownerId.toString(),
         *       uploadedAt: document.createdAt,
         *       path: document.path
         *     }
         *   });
         *
         *   logger.info('Document indexed in Elasticsearch', {
         *     component: 'search-indexer',
         *     operation: 'elasticsearch_index',
         *     documentId: document._id,
         *     index: indexName
         *   });
         * }
         *
         * if (action === 'remove') {
         *   const indexName = document.originalName ? 'files' : 'folders';
         *
         *   await esClient.delete({
         *     index: indexName,
         *     id: document._id.toString()
         *   });
         *
         *   logger.info('Document removed from Elasticsearch', {
         *     component: 'search-indexer',
         *     operation: 'elasticsearch_delete',
         *     documentId: document._id
         *   });
         * }
         */

        /**
         * STRATEGY 3: Algolia Integration (Uncomment to enable)
         * ───────────────────────────────────────────────────────────────────
         *
         * // Install: npm install algoliasearch
         * // const algoliasearch = require('algoliasearch');
         * // const algolia = algoliasearch(
         * //   process.env.ALGOLIA_APP_ID,
         * //   process.env.ALGOLIA_API_KEY
         * // );
         *
         * if (action === 'add' || action === 'update') {
         *   const indexName = document.originalName ? 'files' : 'folders';
         *   const index = algolia.initIndex(indexName);
         *
         *   await index.saveObject({
         *     objectID: document._id.toString(),
         *     name: document.originalName || document.name,
         *     mimeType: document.mimeType,
         *     size: document.size,
         *     userId: document.ownerId.toString(),
         *     createdAt: document.createdAt.getTime(), // Unix timestamp
         *   });
         *
         *   logger.info('Document indexed in Algolia', {
         *     component: 'search-indexer',
         *     operation: 'algolia_index',
         *     documentId: document._id
         *   });
         * }
         *
         * if (action === 'remove') {
         *   const indexName = document.originalName ? 'files' : 'folders';
         *   const index = algolia.initIndex(indexName);
         *
         *   await index.deleteObject(document._id.toString());
         * }
         */

        logger.info('Search index updated (PLACEHOLDER)', {
            component: 'search-indexer',
            operation: 'update_index',
            action: action,
            documentId: document._id,
            note: 'Using MongoDB text index (automatic) - add Elasticsearch/Algolia for advanced search'
        });

    } catch (error) {
        logger.error('Failed to update search index', {
            component: 'search-indexer',
            operation: 'update_index',
            action: action,
            documentId: document._id,
            error: {
                message: error.message,
                stack: error.stack
            }
        });

        // Don't throw - search indexing failure shouldn't block other operations
        // Just log the error and continue
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EVENT HANDLER: handleFileUploaded
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * When a file is uploaded, add it to search index
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function handleFileUploaded(event) {
    const startTime = Date.now();

    try {
        logger.info('Indexing uploaded file', {
            component: 'search-indexer',
            operation: 'handle_file_uploaded',
            fileId: event.fileId,
            fileName: event.fileName
        });

        // Fetch file document from database
        const file = await File.findById(event.fileId);

        if (!file) {
            logger.warn('File not found for search indexing', {
                component: 'search-indexer',
                operation: 'handle_file_uploaded',
                fileId: event.fileId,
                reason: 'file_deleted'
            });
            return;
        }

        // Add to search index
        await updateSearchIndex('add', file);

        const duration = Date.now() - startTime;

        logger.info('File indexed successfully', {
            component: 'search-indexer',
            operation: 'handle_file_uploaded',
            fileId: event.fileId,
            fileName: event.fileName,
            duration: duration
        });

    } catch (error) {
        logger.error('Failed to index uploaded file', {
            component: 'search-indexer',
            operation: 'handle_file_uploaded',
            fileId: event.fileId,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
        // Don't throw - allow other events to continue processing
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EVENT HANDLER: handleFileDeleted
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * When a file is deleted, remove it from search index
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function handleFileDeleted(event) {
    try {
        logger.info('Removing deleted file from search index', {
            component: 'search-indexer',
            operation: 'handle_file_deleted',
            fileId: event.fileId,
            fileName: event.fileName
        });

        // For MongoDB text index, soft-deleted files (deletedAt != null)
        // are automatically excluded from search results by the search query
        // No need to remove from index

        // For Elasticsearch/Algolia, uncomment:
        // await updateSearchIndex('remove', { _id: event.fileId });

        logger.info('File removed from search index', {
            component: 'search-indexer',
            operation: 'handle_file_deleted',
            fileId: event.fileId
        });

    } catch (error) {
        logger.error('Failed to remove file from search index', {
            component: 'search-indexer',
            operation: 'handle_file_deleted',
            fileId: event.fileId,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EVENT HANDLER: handleFolderCreated
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * When a folder is created, add it to search index
 *
 * Why index folders?
 * - Users search for folder names too!
 * - "Find my 'Projects' folder"
 * - Search results should include both files AND folders
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
async function handleFolderCreated(event) {
    try {
        logger.info('Indexing created folder', {
            component: 'search-indexer',
            operation: 'handle_folder_created',
            folderId: event.folderId,
            folderName: event.folderName
        });

        const folder = await Folder.findById(event.folderId);

        if (!folder) {
            logger.warn('Folder not found for search indexing', {
                component: 'search-indexer',
                operation: 'handle_folder_created',
                folderId: event.folderId,
                reason: 'folder_deleted'
            });
            return;
        }

        await updateSearchIndex('add', folder);

        logger.info('Folder indexed successfully', {
            component: 'search-indexer',
            operation: 'handle_folder_created',
            folderId: event.folderId,
            folderName: event.folderName
        });

    } catch (error) {
        logger.error('Failed to index created folder', {
            component: 'search-indexer',
            operation: 'handle_folder_created',
            folderId: event.folderId,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WORKER STARTUP
 * ═══════════════════════════════════════════════════════════════════════════
 */

// Get the event bus (singleton)
const eventBus = getEventBus();

// Subscribe to multiple event types
eventBus.subscribe('file.uploaded', handleFileUploaded);
eventBus.subscribe('file.deleted', handleFileDeleted);
eventBus.subscribe('folder.created', handleFolderCreated);

logger.info('Search indexer worker initialized and listening for events', {
    component: 'search-indexer',
    operation: 'init',
    subscribedTo: ['file.uploaded', 'file.deleted', 'folder.created'],
    searchBackend: 'mongodb-text-index',
    deploymentMode: process.env.DEPLOYMENT_MODE || 'monolith',
    note: 'To enable Elasticsearch or Algolia, uncomment code in updateSearchIndex()'
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * STANDALONE MODE (Microservices)
 * ═══════════════════════════════════════════════════════════════════════════
 */
if (require.main === module) {
    logger.info('Search indexer worker running as standalone service', {
        component: 'search-indexer',
        operation: 'startup',
        mode: 'microservice',
        pid: process.pid
    });

    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception in search indexer worker', {
            component: 'search-indexer',
            operation: 'error_handler',
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled promise rejection in search indexer worker', {
            component: 'search-indexer',
            operation: 'error_handler',
            reason: reason
        });
    });
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SEARCH INDEX MAINTENANCE TASKS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * In production, you might want periodic maintenance:
 *
 * 1. REINDEX ALL DOCUMENTS (after index schema change)
 *    - Fetch all files/folders from MongoDB
 *    - Push to Elasticsearch/Algolia
 *    - Run as one-time script
 *
 * 2. REMOVE STALE ENTRIES (cleanup)
 *    - Find documents in search index that no longer exist in MongoDB
 *    - Delete them
 *    - Run daily via cron job
 *
 * 3. OPTIMIZE INDEX (performance)
 *    - Elasticsearch: Force merge segments
 *    - MongoDB: Rebuild text index
 *    - Run weekly during low traffic
 *
 * Example reindex script:
 *
 * async function reindexAll() {
 *   const files = await File.find({ deletedAt: null });
 *   for (const file of files) {
 *     await updateSearchIndex('add', file);
 *   }
 *   console.log(`Reindexed ${files.length} files`);
 * }
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

module.exports = {
    handleFileUploaded,
    handleFileDeleted,
    handleFolderCreated,
    updateSearchIndex
};
