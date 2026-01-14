/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EVENT BUS ABSTRACTION LAYER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This file implements the "Modular Monolith" pattern, allowing OpenDrive to:
 * 1. Run as a MONOLITH (single container) with in-memory event handling
 * 2. Run as MICROSERVICES (multiple containers) with Kafka-based messaging
 *
 * The key insight: Your application code stays THE SAME regardless of deployment.
 * Only the transport mechanism (in-memory vs Kafka) changes based on configuration.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * HOW IT WORKS:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * When you write code like:
 *
 *   await eventBus.publish('file.uploaded', { fileId: '123', userId: 'abc' });
 *
 * What happens depends on DEPLOYMENT_MODE:
 *
 * [MONOLITH MODE] (DEPLOYMENT_MODE=monolith or not set)
 * ────────────────────────────────────────────────────────────────────────────
 *   → Uses Node.js EventEmitter (built-in)
 *   → Events stay in-memory, same process
 *   → Handlers execute IMMEDIATELY (synchronous)
 *   → Perfect for: Home servers, small teams, development
 *   → Cost: $0 extra (no Kafka needed)
 *
 *   Example flow:
 *   1. File uploaded → eventBus.publish('file.uploaded', data)
 *   2. EventEmitter immediately calls ALL registered handlers
 *   3. Thumbnail worker (in same process) receives event instantly
 *   4. All done in milliseconds, same memory space
 *
 * [MICROSERVICES MODE] (DEPLOYMENT_MODE=microservices)
 * ────────────────────────────────────────────────────────────────────────────
 *   → Uses Kafka (distributed message broker)
 *   → Events sent over network to Kafka cluster
 *   → Handlers run in SEPARATE containers/processes
 *   → Perfect for: High-scale, enterprise, 1000+ users
 *   → Cost: ~$50-100/month for Kafka
 *
 *   Example flow:
 *   1. File uploaded in Container A → eventBus.publish('file.uploaded', data)
 *   2. Message sent to Kafka broker (network call)
 *   3. Thumbnail worker in Container B consumes message
 *   4. Search indexer in Container C also consumes SAME message
 *   5. Each service processes independently, at own pace
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS DESIGN?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * [Problem 1: Direct Function Calls Are Tightly Coupled]
 *
 *   // BAD: Monolith with tight coupling
 *   async function uploadFile(file) {
 *     await saveToStorage(file);
 *     await createThumbnail(file);    // ← Coupled to thumbnail service
 *     await updateSearch(file);        // ← Coupled to search service
 *     await sendNotification(file);    // ← Coupled to notification service
 *   }
 *
 *   Issues:
 *   - Adding new feature = modify uploadFile()
 *   - If thumbnail service crashes, upload fails
 *   - Can't scale thumbnail generation independently
 *
 * [Solution: Event-Driven Architecture]
 *
 *   // GOOD: Decoupled with events
 *   async function uploadFile(file) {
 *     await saveToStorage(file);
 *     await eventBus.publish('file.uploaded', { fileId, userId });
 *     // Done! Upload service doesn't care who consumes this event
 *   }
 *
 *   // Somewhere else (same process or different container):
 *   eventBus.subscribe('file.uploaded', async (event) => {
 *     await createThumbnail(event.fileId);
 *   });
 *
 *   Benefits:
 *   ✓ Upload service knows nothing about thumbnails
 *   ✓ Add new consumers without touching upload code
 *   ✓ If thumbnail fails, upload still succeeds
 *   ✓ Scale thumbnail workers independently (10 workers vs 2 upload services)
 *
 * [Problem 2: Monolith vs Microservices Requires Rewrite]
 *
 *   Typical approach: Build monolith, then rewrite everything for microservices
 *   Our approach: Write once, deploy both ways via configuration
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Environment variables (.env file):
 *
 * [For MONOLITH deployment]
 * ────────────────────────────
 * DEPLOYMENT_MODE=monolith          # or leave unset (default)
 * # That's it! No Kafka needed.
 *
 * [For MICROSERVICES deployment]
 * ────────────────────────────
 * DEPLOYMENT_MODE=microservices
 * KAFKA_BROKERS=kafka1:9092,kafka2:9092,kafka3:9092
 * KAFKA_CLIENT_ID=opendrive-service
 *
 * # For Confluent Cloud (managed Kafka):
 * KAFKA_SASL_USERNAME=your-api-key
 * KAFKA_SASL_PASSWORD=your-api-secret
 *
 * # For self-hosted Kafka (no auth):
 * # Just set KAFKA_BROKERS, leave SASL vars empty
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

const EventEmitter = require('events');
const logger = require('./logger');

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLASS: InMemoryEventBus
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Used when: DEPLOYMENT_MODE=monolith (or not set)
 *
 * This is a WRAPPER around Node.js's built-in EventEmitter.
 * Why wrap instead of using EventEmitter directly?
 * → To provide the SAME API as KafkaEventBus
 * → Your code calls .publish() and .subscribe() regardless of mode
 *
 * ───────────────────────────────────────────────────────────────────────────
 * HOW NODE.JS EventEmitter WORKS:
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Think of it like a radio station:
 * - Radio station broadcasts on frequency "file.uploaded" (topic)
 * - Multiple radios tune in to that frequency (subscribers)
 * - When station broadcasts (publish), all radios hear it immediately
 *
 * Code example:
 *
 *   const emitter = new EventEmitter();
 *
 *   // Radio 1 tunes in
 *   emitter.on('file.uploaded', (data) => {
 *     console.log('Radio 1 heard:', data);
 *   });
 *
 *   // Radio 2 tunes in (to SAME frequency)
 *   emitter.on('file.uploaded', (data) => {
 *     console.log('Radio 2 heard:', data);
 *   });
 *
 *   // Station broadcasts
 *   emitter.emit('file.uploaded', { fileId: '123' });
 *
 *   // Output:
 *   // Radio 1 heard: { fileId: '123' }
 *   // Radio 2 heard: { fileId: '123' }
 *
 * Key properties:
 * ✓ INSTANT delivery (microseconds)
 * ✓ ALL listeners receive SAME event
 * ✓ Synchronous (blocks until all handlers complete)
 * ✓ In-memory only (no persistence, no network)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
class InMemoryEventBus {
    constructor() {
        /**
         * Create the underlying EventEmitter
         * This is what actually stores and dispatches events
         */
        this.emitter = new EventEmitter();

        /**
         * Increase max listeners from default (10) to 100
         *
         * Why? You might have many subscribers to same event:
         * - 'file.uploaded' → thumbnail worker, search indexer, analytics, audit log
         *
         * Default is 10 to prevent memory leaks from accidental infinite listeners.
         * We intentionally want many, so we raise the limit.
         */
        this.emitter.setMaxListeners(100);

        logger.info('EventBus initialized in IN-MEMORY mode', {
            component: 'eventbus',
            operation: 'init',
            mode: 'in-memory',
            message: 'Events will be handled synchronously in-process'
        });
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * METHOD: publish
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Publish an event to all subscribers
     *
     * @param {string} topic - Event name (e.g., 'file.uploaded', 'user.registered')
     * @param {object} event - Event data (plain JavaScript object)
     *
     * ───────────────────────────────────────────────────────────────────────
     * WHAT HAPPENS INTERNALLY:
     * ───────────────────────────────────────────────────────────────────────
     *
     * 1. Method called: eventBus.publish('file.uploaded', { fileId: '123' })
     *
     * 2. EventEmitter.emit() is called with topic and event
     *
     * 3. EventEmitter looks up ALL listeners registered for 'file.uploaded'
     *    Suppose we have:
     *    - thumbnailHandler
     *    - searchHandler
     *    - analyticsHandler
     *
     * 4. EventEmitter calls EACH handler SYNCHRONOUSLY:
     *    thumbnailHandler({ fileId: '123' })    // Blocks until complete
     *    searchHandler({ fileId: '123' })       // Then this one
     *    analyticsHandler({ fileId: '123' })    // Finally this one
     *
     * 5. All handlers complete, publish() returns
     *
     * ───────────────────────────────────────────────────────────────────────
     * TIMING EXAMPLE:
     * ───────────────────────────────────────────────────────────────────────
     *
     * Time: 0ms    → publish() called
     * Time: 0ms    → EventEmitter.emit() starts
     * Time: 0ms    → thumbnailHandler starts
     * Time: 50ms   → thumbnailHandler finishes
     * Time: 50ms   → searchHandler starts
     * Time: 70ms   → searchHandler finishes
     * Time: 70ms   → analyticsHandler starts
     * Time: 72ms   → analyticsHandler finishes
     * Time: 72ms   → publish() returns
     *
     * Total: 72ms (all handlers executed in sequence)
     *
     * Compare to Kafka: publish() returns in ~5ms, handlers process async
     *
     * ───────────────────────────────────────────────────────────────────────
     * WHY ASYNC FUNCTION? (even though EventEmitter is sync)
     * ───────────────────────────────────────────────────────────────────────
     *
     * For API consistency with KafkaEventBus.publish() which IS async.
     * This way your code can use:
     *
     *   await eventBus.publish('file.uploaded', data);
     *
     * And it works in BOTH monolith and microservices mode!
     *
     * ═══════════════════════════════════════════════════════════════════════
     */
    async publish(topic, event) {
        try {
            // Add metadata to event (timestamp, event type)
            const enrichedEvent = {
                ...event,
                eventType: topic,
                timestamp: new Date().toISOString(),
                source: 'in-memory-eventbus'
            };

            // Emit to all listeners (synchronous)
            this.emitter.emit(topic, enrichedEvent);

            // Log for debugging/monitoring
            logger.debug('Event published (in-memory)', {
                component: 'eventbus',
                operation: 'publish',
                topic: topic,
                eventData: enrichedEvent,
                listenerCount: this.emitter.listenerCount(topic)
            });
        } catch (error) {
            logger.error('Failed to publish event (in-memory)', {
                component: 'eventbus',
                operation: 'publish',
                topic: topic,
                error: {
                    message: error.message,
                    stack: error.stack
                }
            });
            throw error;
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * METHOD: subscribe
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Register a handler function to listen for events on a topic
     *
     * @param {string} topic - Event name to listen for
     * @param {function} handler - Async function that processes the event
     *
     * ───────────────────────────────────────────────────────────────────────
     * EXAMPLE USAGE:
     * ───────────────────────────────────────────────────────────────────────
     *
     * // In workers/thumbnail.js (or anywhere in your app)
     * const { getEventBus } = require('../utils/eventBus');
     * const eventBus = getEventBus();
     *
     * eventBus.subscribe('file.uploaded', async (event) => {
     *   // This function runs every time someone publishes 'file.uploaded'
     *   console.log(`Creating thumbnail for file ${event.fileId}`);
     *   await createThumbnail(event.fileId);
     * });
     *
     * ───────────────────────────────────────────────────────────────────────
     * WHAT HAPPENS INTERNALLY:
     * ───────────────────────────────────────────────────────────────────────
     *
     * 1. subscribe('file.uploaded', myHandler) called
     *
     * 2. We wrap your handler to catch errors:
     *    - If handler throws error, we log it but don't crash
     *    - Other handlers still execute
     *
     * 3. EventEmitter.on() registers the wrapped handler
     *
     * 4. Now whenever someone calls publish('file.uploaded', data):
     *    → Your handler automatically gets called with the data
     *
     * ───────────────────────────────────────────────────────────────────────
     * ERROR HANDLING:
     * ───────────────────────────────────────────────────────────────────────
     *
     * If your handler throws an error:
     * ✓ Error is logged (not lost)
     * ✓ Other handlers still run (not affected)
     * ✗ No retry mechanism (if you need retries, use Kafka mode)
     *
     * Example:
     *
     *   eventBus.subscribe('file.uploaded', async (event) => {
     *     throw new Error('Thumbnail generation failed!');
     *   });
     *
     *   eventBus.subscribe('file.uploaded', async (event) => {
     *     console.log('I still run!'); // This WILL execute
     *   });
     *
     * ═══════════════════════════════════════════════════════════════════════
     */
    subscribe(topic, handler) {
        /**
         * Wrap the handler to provide error handling
         * Without this, an error in one handler would crash the entire app
         */
        const wrappedHandler = async (event) => {
            try {
                await handler(event);
            } catch (error) {
                logger.error('Event handler failed (in-memory)', {
                    component: 'eventbus',
                    operation: 'handler',
                    topic: topic,
                    event: event,
                    error: {
                        message: error.message,
                        stack: error.stack
                    }
                });
                // Don't re-throw - let other handlers continue
            }
        };

        // Register with EventEmitter
        this.emitter.on(topic, wrappedHandler);

        logger.info('Event handler registered (in-memory)', {
            component: 'eventbus',
            operation: 'subscribe',
            topic: topic,
            totalListeners: this.emitter.listenerCount(topic)
        });
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * METHOD: close
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Cleanup method - removes all listeners
     *
     * Called during graceful shutdown to prevent memory leaks
     *
     * ═══════════════════════════════════════════════════════════════════════
     */
    async close() {
        this.emitter.removeAllListeners();
        logger.info('EventBus closed (in-memory)', {
            component: 'eventbus',
            operation: 'close'
        });
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CLASS: KafkaEventBus
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Used when: DEPLOYMENT_MODE=microservices
 *
 * This wraps the KafkaJS library to provide the SAME API as InMemoryEventBus.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * WHAT IS KAFKA? (Simple Explanation)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Kafka is like a post office for messages between services:
 *
 * 1. TOPICS = Mailboxes
 *    Each topic (e.g., 'file.uploaded') is a separate mailbox
 *
 * 2. PRODUCERS = People sending mail
 *    Your file service "produces" messages to the 'file.uploaded' topic
 *
 * 3. CONSUMERS = People checking mailbox
 *    Thumbnail worker "consumes" messages from 'file.uploaded' topic
 *
 * 4. BROKERS = Post office branches
 *    Kafka cluster has 3-5 brokers for reliability
 *
 * Key differences from in-memory:
 * ✓ Messages PERSIST on disk (survive crashes)
 * ✓ Messages delivered over NETWORK (different machines)
 * ✓ Messages can be REPLAYED (seek back in time)
 * ✓ Multiple consumers can read SAME message (pub-sub pattern)
 * ✗ Slight latency (~5-20ms per message)
 * ✗ Requires external infrastructure (Kafka cluster)
 *
 * ───────────────────────────────────────────────────────────────────────────
 * KAFKA CONCEPTS IN DEPTH:
 * ───────────────────────────────────────────────────────────────────────────
 *
 * [Topics]
 * A category/channel for messages. Think of it like a table in a database.
 * Examples: 'file.uploaded', 'user.registered', 'share.created'
 *
 * [Partitions]
 * Each topic is split into partitions for parallelism.
 *
 * Example: 'file.uploaded' topic with 3 partitions
 *
 *   Partition 0: [msg1] [msg4] [msg7] ...
 *   Partition 1: [msg2] [msg5] [msg8] ...
 *   Partition 2: [msg3] [msg6] [msg9] ...
 *
 * Why? So 3 consumers can process in parallel:
 *   Consumer A reads Partition 0
 *   Consumer B reads Partition 1
 *   Consumer C reads Partition 2
 *
 * [Consumer Groups]
 * Multiple consumers that share the workload.
 *
 * Example: 5 thumbnail workers in consumer group "thumbnail-workers"
 * If topic has 10 partitions:
 *   Worker 1 gets partitions 0, 1
 *   Worker 2 gets partitions 2, 3
 *   Worker 3 gets partitions 4, 5
 *   Worker 4 gets partitions 6, 7
 *   Worker 5 gets partitions 8, 9
 *
 * If Worker 3 crashes, Kafka automatically reassigns partitions 4, 5 to others!
 *
 * [Offsets]
 * Position in the partition. Like a bookmark.
 *
 * Example: Consumer processes messages at offsets 0, 1, 2, 3...
 * If consumer restarts, it resumes from last committed offset (doesn't re-process)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
class KafkaEventBus {
    constructor() {
        /**
         * Lazy-load KafkaJS library
         * Why? So InMemoryEventBus doesn't require kafka as dependency
         * If you're running monolith, you don't need to install kafkajs package
         */
        let kafka, Kafka;
        try {
            const kafkajs = require('kafkajs');
            Kafka = kafkajs.Kafka;
        } catch (error) {
            logger.error('KafkaJS not installed - run: npm install kafkajs', {
                component: 'eventbus',
                operation: 'init',
                error: {
                    message: error.message
                }
            });
            throw new Error('KafkaJS library not found. Install with: npm install kafkajs');
        }

        /**
         * ───────────────────────────────────────────────────────────────────
         * KAFKA CLIENT CONFIGURATION
         * ───────────────────────────────────────────────────────────────────
         *
         * Required environment variables:
         * - KAFKA_BROKERS: comma-separated list of broker addresses
         *   Example: "kafka1:9092,kafka2:9092,kafka3:9092"
         *
         * - KAFKA_CLIENT_ID: identifier for this application
         *   Example: "opendrive-file-service"
         *   Used in Kafka logs to identify which service sent messages
         *
         * Optional (for authentication):
         * - KAFKA_SASL_USERNAME: API key (Confluent Cloud)
         * - KAFKA_SASL_PASSWORD: API secret
         *
         * ───────────────────────────────────────────────────────────────────
         */
        const brokers = (process.env.KAFKA_BROKERS || process.env.KAFKA_BOOTSTRAP_SERVERS || '').split(',').filter(Boolean);

        if (brokers.length === 0) {
            throw new Error('KAFKA_BROKERS or KAFKA_BOOTSTRAP_SERVERS environment variable is required for microservices mode');
        }

        const clientId = process.env.KAFKA_CLIENT_ID || 'opendrive';

        /**
         * Build Kafka client configuration
         * Supports both authenticated (Confluent Cloud) and unauthenticated (self-hosted)
         */
        const kafkaConfig = {
            clientId: clientId,
            brokers: brokers,

            /**
             * Connection timeout: how long to wait for broker connection
             * Default is 10000ms (10 seconds), we increase to 30s for slow networks
             */
            connectionTimeout: 30000,

            /**
             * Request timeout: how long to wait for broker response
             */
            requestTimeout: 30000,
        };

        /**
         * Add SSL/SASL authentication if credentials provided
         * This is needed for Confluent Cloud and other managed Kafka services
         * Supports both KAFKA_SASL_USERNAME/PASSWORD and KAFKA_API_KEY/SECRET naming
         */
        const saslUsername = process.env.KAFKA_SASL_USERNAME || process.env.KAFKA_API_KEY;
        const saslPassword = process.env.KAFKA_SASL_PASSWORD || process.env.KAFKA_API_SECRET;
        if (saslUsername && saslPassword) {
            kafkaConfig.ssl = true;
            kafkaConfig.sasl = {
                mechanism: 'plain', // SASL/PLAIN authentication
                username: saslUsername,
                password: saslPassword
            };
        }

        // Create Kafka client
        this.kafka = new Kafka(kafkaConfig);

        /**
         * ───────────────────────────────────────────────────────────────────
         * KAFKA PRODUCER
         * ───────────────────────────────────────────────────────────────────
         *
         * Producer = sends messages to Kafka topics
         *
         * Our configuration:
         * - allowAutoTopicCreation: true
         *   → If you publish to a topic that doesn't exist, create it automatically
         *   → Useful for development, disable in production
         *
         * - idempotent: true
         *   → Prevents duplicate messages if network fails mid-send
         *   → Producer assigns sequence numbers to messages
         *   → Kafka broker deduplicates based on sequence number
         *
         * - maxInFlightRequests: 5
         *   → How many requests can be sent without waiting for acknowledgment
         *   → Higher = more throughput, but more memory usage
         *
         * ───────────────────────────────────────────────────────────────────
         */
        this.producer = this.kafka.producer({
            allowAutoTopicCreation: true,
            idempotent: true,
            maxInFlightRequests: 5,
        });

        /**
         * Admin client for topic management
         * Used to create topics programmatically
         */
        this.admin = this.kafka.admin();

        /**
         * Map of topic → consumer instance
         * We create a separate consumer for each topic we subscribe to
         */
        this.consumers = new Map();

        /**
         * Connection state tracking
         */
        this.connected = false;
        this.connecting = false;

        logger.info('EventBus initialized in KAFKA mode', {
            component: 'eventbus',
            operation: 'init',
            mode: 'kafka',
            brokers: brokers,
            clientId: clientId,
            authenticated: !!(process.env.KAFKA_SASL_USERNAME || process.env.KAFKA_API_KEY),
            message: 'Events will be sent to Kafka cluster'
        });
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * METHOD: connect
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Establish connection to Kafka broker
     *
     * This is called automatically on first publish/subscribe
     * You can also call it manually during app startup for fail-fast behavior
     *
     * ───────────────────────────────────────────────────────────────────────
     * WHAT HAPPENS:
     * ───────────────────────────────────────────────────────────────────────
     *
     * 1. Connect producer to broker
     *    → Opens TCP connection to broker
     *    → Authenticates if SASL configured
     *    → Fetches topic metadata
     *
     * 2. Auto-create topics if needed
     *    → Scans environment for required topics
     *    → Creates any that don't exist
     *    → Sets partition count and replication factor
     *
     * ───────────────────────────────────────────────────────────────────────
     * RETRY LOGIC:
     * ───────────────────────────────────────────────────────────────────────
     *
     * If connection fails, KafkaJS automatically retries:
     * - Retry 1: wait 300ms
     * - Retry 2: wait 600ms
     * - Retry 3: wait 900ms
     * - ... up to 30 seconds
     *
     * After max retries, throws error
     *
     * ═══════════════════════════════════════════════════════════════════════
     */
    async connect() {
        // Guard against multiple simultaneous connect() calls
        if (this.connected) {
            return;
        }

        if (this.connecting) {
            // Wait for existing connection attempt
            while (this.connecting) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return;
        }

        try {
            this.connecting = true;

            logger.info('Connecting to Kafka cluster...', {
                component: 'eventbus',
                operation: 'connect',
                brokers: process.env.KAFKA_BROKERS
            });

            // Connect producer
            await this.producer.connect();

            // Ensure required topics exist
            await this.ensureTopicsExist();

            this.connected = true;
            this.connecting = false;

            logger.info('Connected to Kafka successfully', {
                component: 'eventbus',
                operation: 'connect',
                status: 'connected'
            });
        } catch (error) {
            this.connecting = false;

            logger.error('Failed to connect to Kafka', {
                component: 'eventbus',
                operation: 'connect',
                error: {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                }
            });

            throw error;
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * METHOD: ensureTopicsExist
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Programmatically create Kafka topics if they don't exist
     *
     * This solves the "Confluent Cloud doesn't support auto-creation" problem!
     *
     * ───────────────────────────────────────────────────────────────────────
     * HOW IT WORKS:
     * ───────────────────────────────────────────────────────────────────────
     *
     * 1. Define list of required topics (see REQUIRED_TOPICS below)
     *
     * 2. Connect to Kafka Admin API
     *
     * 3. List existing topics
     *
     * 4. Find topics that don't exist yet
     *
     * 5. Create them with specified partition count & replication
     *
     * ───────────────────────────────────────────────────────────────────────
     * TOPIC CONFIGURATION:
     * ───────────────────────────────────────────────────────────────────────
     *
     * For each topic, we specify:
     *
     * - numPartitions: How many partitions (affects parallelism)
     *   More partitions = more consumers can process in parallel
     *   Rule of thumb: 2x your expected number of consumers
     *   Example: If you'll run 3 thumbnail workers, use 6 partitions
     *
     * - replicationFactor: How many copies of data
     *   1 = no redundancy (data lost if broker dies)
     *   3 = data on 3 brokers (Confluent Cloud requires 3)
     *   Self-hosted can use 1 for development
     *
     * ═══════════════════════════════════════════════════════════════════════
     */
    async ensureTopicsExist() {
        /**
         * Define all topics your application uses
         *
         * Add new topics here as you add features!
         *
         * Topic naming convention: <resource>.<action>
         * Examples:
         * - file.uploaded   (when file upload completes)
         * - file.deleted    (when file moved to trash)
         * - user.registered (when new user signs up)
         * - share.created   (when share link generated)
         */
        const REQUIRED_TOPICS = [
            { topic: 'file.uploaded', numPartitions: 6 },
            { topic: 'file.deleted', numPartitions: 3 },
            { topic: 'file.downloaded', numPartitions: 3 },
            { topic: 'share.created', numPartitions: 3 },
            { topic: 'share.revoked', numPartitions: 3 },
            { topic: 'user.registered', numPartitions: 1 },
            { topic: 'folder.created', numPartitions: 3 },
            { topic: 'folder.deleted', numPartitions: 3 },
        ];

        try {
            // Connect admin client
            await this.admin.connect();

            // Get list of existing topics
            const existingTopics = await this.admin.listTopics();

            // Find topics that need to be created
            const topicsToCreate = REQUIRED_TOPICS.filter(
                t => !existingTopics.includes(t.topic)
            );

            if (topicsToCreate.length > 0) {
                logger.info(`Creating ${topicsToCreate.length} Kafka topics...`, {
                    component: 'eventbus',
                    operation: 'ensure_topics',
                    topics: topicsToCreate.map(t => t.topic)
                });

                /**
                 * Determine replication factor
                 *
                 * Confluent Cloud requires 3 replicas
                 * Self-hosted Kafka can use 1 for development
                 *
                 * We detect Confluent Cloud by checking for SASL auth
                 * (supports both KAFKA_SASL_USERNAME and KAFKA_API_KEY naming)
                 */
                const isConfluentCloud = process.env.KAFKA_SASL_USERNAME || process.env.KAFKA_API_KEY;
                const replicationFactor = isConfluentCloud ? 3 : 1;

                await this.admin.createTopics({
                    topics: topicsToCreate.map(t => ({
                        topic: t.topic,
                        numPartitions: t.numPartitions,
                        replicationFactor: replicationFactor,
                    })),
                    waitForLeaders: true, // Wait until partition leaders elected
                });

                logger.info('Kafka topics created successfully', {
                    component: 'eventbus',
                    operation: 'ensure_topics',
                    created: topicsToCreate.map(t => t.topic),
                    replicationFactor: replicationFactor
                });
            } else {
                logger.debug('All required Kafka topics already exist', {
                    component: 'eventbus',
                    operation: 'ensure_topics',
                    topicCount: REQUIRED_TOPICS.length
                });
            }

            // Disconnect admin (not needed after setup)
            await this.admin.disconnect();
        } catch (error) {
            logger.error('Failed to ensure Kafka topics exist', {
                component: 'eventbus',
                operation: 'ensure_topics',
                error: {
                    message: error.message,
                    stack: error.stack
                }
            });

            // Don't throw - app can still work if topics already exist
            // Only throw if we can't connect at all (handled by connect())
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * METHOD: publish
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Send a message to a Kafka topic
     *
     * @param {string} topic - Kafka topic name
     * @param {object} event - Event data (will be JSON serialized)
     *
     * ───────────────────────────────────────────────────────────────────────
     * WHAT HAPPENS STEP-BY-STEP:
     * ───────────────────────────────────────────────────────────────────────
     *
     * 1. Call: await eventBus.publish('file.uploaded', { fileId: '123' })
     *
     * 2. Check if producer connected, connect if not
     *
     * 3. Enrich event with metadata:
     *    {
     *      fileId: '123',              // Your data
     *      eventType: 'file.uploaded', // Topic name
     *      timestamp: '2024-01-10T...' // When event created
     *      source: 'kafka-eventbus'    // Where it came from
     *    }
     *
     * 4. Serialize to JSON: '{"fileId":"123",...}'
     *
     * 5. Send to Kafka producer.send():
     *    - Producer batches messages for efficiency
     *    - Compresses batch (default: snappy compression)
     *    - Sends over network to broker
     *
     * 6. Kafka broker receives message:
     *    - Appends to partition log on disk
     *    - Replicates to 2 other brokers (if replication=3)
     *    - Sends acknowledgment back to producer
     *
     * 7. Producer receives ACK, promise resolves
     *
     * 8. publish() returns (total time: ~5-20ms)
     *
     * ───────────────────────────────────────────────────────────────────────
     * MESSAGE STRUCTURE:
     * ───────────────────────────────────────────────────────────────────────
     *
     * Kafka messages have:
     *
     * - key (optional): Used for partition assignment
     *   Messages with same key go to same partition (ordering guarantee)
     *   Example: key=userId ensures all events for a user are ordered
     *
     * - value (required): The actual message payload
     *   We JSON-serialize the event object
     *
     * - timestamp: When message was created
     *   Automatically added by Kafka
     *
     * - headers (optional): Metadata (we don't use this yet)
     *
     * ───────────────────────────────────────────────────────────────────────
     * PARTITIONING STRATEGY:
     * ───────────────────────────────────────────────────────────────────────
     *
     * We use userId as the partition key (if present in event).
     * This ensures all events for a user go to the same partition.
     *
     * Why? Imagine user uploads 5 files rapidly:
     * - All 5 'file.uploaded' events go to SAME partition
     * - Consumer processes them IN ORDER
     * - Prevents race conditions
     *
     * If no userId (or no key), Kafka uses round-robin partitioning:
     * - Message 1 → Partition 0
     * - Message 2 → Partition 1
     * - Message 3 → Partition 2
     * - Message 4 → Partition 0 (wraps around)
     *
     * ═══════════════════════════════════════════════════════════════════════
     */
    async publish(topic, event) {
        try {
            // Ensure connected to Kafka
            await this.connect();

            // Enrich event with metadata
            const enrichedEvent = {
                ...event,
                eventType: topic,
                timestamp: new Date().toISOString(),
                source: 'kafka-eventbus'
            };

            /**
             * Partition key: use userId if available, otherwise null (round-robin)
             * This ensures events for same user are processed in order
             */
            const key = event.userId ? event.userId.toString() : null;

            // Send message to Kafka
            await this.producer.send({
                topic: topic,
                messages: [
                    {
                        key: key,
                        value: JSON.stringify(enrichedEvent),
                    }
                ]
            });

            logger.debug('Event published to Kafka', {
                component: 'eventbus',
                operation: 'publish',
                topic: topic,
                key: key,
                eventData: enrichedEvent
            });
        } catch (error) {
            logger.error('Failed to publish event to Kafka', {
                component: 'eventbus',
                operation: 'publish',
                topic: topic,
                event: event,
                error: {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                }
            });

            throw error;
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * METHOD: subscribe
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Register a handler to consume messages from a Kafka topic
     *
     * @param {string} topic - Kafka topic to consume from
     * @param {function} handler - Async function to process each message
     *
     * ───────────────────────────────────────────────────────────────────────
     * WHAT HAPPENS STEP-BY-STEP:
     * ───────────────────────────────────────────────────────────────────────
     *
     * 1. Call: eventBus.subscribe('file.uploaded', myHandler)
     *
     * 2. Create a Kafka consumer with unique group ID:
     *    groupId = "opendrive-file.uploaded-worker"
     *
     *    Why unique per topic?
     *    → Each consumer group gets its own copy of messages
     *    → If you want multiple services to process same event, use different groups
     *
     * 3. Consumer connects to Kafka broker
     *
     * 4. Consumer subscribes to topic
     *
     * 5. Kafka assigns partitions to this consumer:
     *    - If topic has 6 partitions and this is only consumer: gets all 6
     *    - If 2 consumers in group: each gets 3 partitions
     *    - If 6 consumers in group: each gets 1 partition
     *
     * 6. Consumer starts polling for messages:
     *    Loop forever:
     *      - Fetch batch of messages from broker
     *      - For each message:
     *        - Deserialize JSON to object
     *        - Call your handler function
     *        - Wait for handler to complete
     *        - Commit offset (mark message as processed)
     *      - Wait 100ms, fetch next batch
     *
     * 7. If consumer crashes:
     *    - Kafka reassigns partitions to other consumers in group
     *    - New consumer resumes from last committed offset
     *    - No messages lost!
     *
     * ───────────────────────────────────────────────────────────────────────
     * CONSUMER GROUPS EXPLAINED:
     * ───────────────────────────────────────────────────────────────────────
     *
     * Consumer group = multiple consumers sharing workload
     *
     * Example: 5 thumbnail workers, all in group "thumbnail-workers"
     *
     * Topic 'file.uploaded' has 10 partitions:
     *
     *   Partition 0, 1  → Worker 1
     *   Partition 2, 3  → Worker 2
     *   Partition 4, 5  → Worker 3
     *   Partition 6, 7  → Worker 4
     *   Partition 8, 9  → Worker 5
     *
     * Each partition is consumed by EXACTLY ONE consumer in the group.
     * This gives you parallelism without duplicate processing!
     *
     * If you want different services to ALL receive messages:
     * → Use DIFFERENT consumer groups
     *
     * Example:
     *   Thumbnail workers: group "thumbnail-workers"
     *   Search indexer:    group "search-indexer"
     *   Analytics:         group "analytics"
     *
     * All three groups receive SAME messages!
     *
     * ───────────────────────────────────────────────────────────────────────
     * OFFSET MANAGEMENT:
     * ───────────────────────────────────────────────────────────────────────
     *
     * Offset = position in partition log
     *
     * Example partition:
     *   [msg0][msg1][msg2][msg3][msg4][msg5] ...
     *    ↑     ↑     ↑     ↑     ↑     ↑
     *    0     1     2     3     4     5     (offsets)
     *
     * Consumer tracks:
     * - Current offset: 3 (processing msg3)
     * - Committed offset: 2 (successfully processed up to msg2)
     *
     * After processing msg3, commit offset 3.
     * If consumer crashes and restarts, resume from offset 3 (not 0).
     *
     * Our config: auto-commit every 5 seconds
     *
     * ═══════════════════════════════════════════════════════════════════════
     */
    async subscribe(topic, handler) {
        try {
            // Ensure producer is connected and topics exist before subscribing
            // This creates the topic if it doesn't exist
            if (!this.connected) {
                await this.connect();
            }

            /**
             * Generate consumer group ID
             *
             * Format: opendrive-{topic}-{serviceName}
             *
             * Examples:
             * - opendrive-file.uploaded-thumbnail-worker
             * - opendrive-file.uploaded-search-indexer
             *
             * The SERVICE_NAME env var differentiates between services consuming same topic
             */
            const serviceName = process.env.SERVICE_NAME || 'worker';
            const groupId = `opendrive-${topic}-${serviceName}`;

            logger.info('Creating Kafka consumer', {
                component: 'eventbus',
                operation: 'subscribe',
                topic: topic,
                groupId: groupId
            });

            /**
             * Create consumer
             *
             * Configuration:
             * - groupId: Consumer group name (for load balancing)
             * - sessionTimeout: If consumer doesn't heartbeat in 30s, kick it out
             * - heartbeatInterval: Send heartbeat every 3s to show "I'm alive"
             */
            const consumer = this.kafka.consumer({
                groupId: groupId,
                sessionTimeout: 30000,
                heartbeatInterval: 3000,
            });

            // Connect to Kafka
            await consumer.connect();

            /**
             * Subscribe to topic
             *
             * fromBeginning: false
             * → Only consume NEW messages (not historical)
             * → Set to true if you want to replay all messages from topic creation
             */
            await consumer.subscribe({
                topic: topic,
                fromBeginning: false
            });

            logger.info('Kafka consumer subscribed to topic', {
                component: 'eventbus',
                operation: 'subscribe',
                topic: topic,
                groupId: groupId
            });

            /**
             * Start consuming messages
             *
             * eachMessage callback is called for EVERY message in the topic
             * Messages are processed one-at-a-time per partition (sequential)
             * Multiple partitions processed in parallel
             */
            await consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        // Deserialize JSON message value to object
                        const event = JSON.parse(message.value.toString());

                        logger.debug('Processing Kafka message', {
                            component: 'eventbus',
                            operation: 'consume',
                            topic: topic,
                            partition: partition,
                            offset: message.offset,
                            key: message.key ? message.key.toString() : null,
                            event: event
                        });

                        // Call user-provided handler
                        await handler(event);

                        // Handler succeeded - offset will be auto-committed

                    } catch (error) {
                        logger.error('Kafka message handler failed', {
                            component: 'eventbus',
                            operation: 'consume',
                            topic: topic,
                            partition: partition,
                            offset: message.offset,
                            error: {
                                message: error.message,
                                stack: error.stack
                            }
                        });

                        /**
                         * Handler failed - what to do?
                         *
                         * Options:
                         * 1. Skip message (commit offset anyway) - message lost
                         * 2. Retry immediately - might fail again, blocks partition
                         * 3. Send to dead-letter queue - process later
                         * 4. Throw error - consumer crashes, Kafka reassigns partition
                         *
                         * We choose option 1: Log error but continue
                         * Production systems often use option 3 (DLQ)
                         */
                    }
                }
            });

            // Store consumer reference for cleanup
            this.consumers.set(topic, consumer);

            logger.info('Kafka consumer running', {
                component: 'eventbus',
                operation: 'subscribe',
                topic: topic,
                groupId: groupId,
                status: 'active'
            });

        } catch (error) {
            logger.error('Failed to subscribe to Kafka topic', {
                component: 'eventbus',
                operation: 'subscribe',
                topic: topic,
                error: {
                    message: error.message,
                    stack: error.stack
                }
            });

            throw error;
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     * METHOD: close
     * ═══════════════════════════════════════════════════════════════════════
     *
     * Graceful shutdown - disconnect all Kafka clients
     *
     * Called during app shutdown to ensure:
     * - Pending messages are sent (flushed)
     * - Offsets are committed
     * - Connections closed properly
     *
     * Without this, you might lose messages in producer buffer!
     *
     * ═══════════════════════════════════════════════════════════════════════
     */
    async close() {
        try {
            logger.info('Closing Kafka EventBus...', {
                component: 'eventbus',
                operation: 'close'
            });

            // Disconnect all consumers
            for (const [topic, consumer] of this.consumers.entries()) {
                logger.debug(`Disconnecting consumer for topic: ${topic}`, {
                    component: 'eventbus',
                    operation: 'close',
                    topic: topic
                });
                await consumer.disconnect();
            }

            // Disconnect producer (flushes pending messages first)
            if (this.connected) {
                await this.producer.disconnect();
            }

            this.consumers.clear();
            this.connected = false;

            logger.info('Kafka EventBus closed successfully', {
                component: 'eventbus',
                operation: 'close'
            });
        } catch (error) {
            logger.error('Error closing Kafka EventBus', {
                component: 'eventbus',
                operation: 'close',
                error: {
                    message: error.message,
                    stack: error.stack
                }
            });

            throw error;
        }
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FACTORY FUNCTION: getEventBus
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Creates and returns the appropriate EventBus instance (singleton pattern)
 *
 * Singleton = only ONE instance exists for entire application
 * Why? We want all parts of app to use the SAME event bus
 *
 * ───────────────────────────────────────────────────────────────────────────
 * USAGE:
 * ───────────────────────────────────────────────────────────────────────────
 *
 * // In any file (routes, workers, services):
 * const { getEventBus } = require('./utils/eventBus');
 * const eventBus = getEventBus();
 *
 * // Now use it:
 * await eventBus.publish('file.uploaded', { fileId: '123' });
 *
 * ───────────────────────────────────────────────────────────────────────────
 * DECISION LOGIC:
 * ───────────────────────────────────────────────────────────────────────────
 *
 * If DEPLOYMENT_MODE === 'microservices':
 *   → Return KafkaEventBus
 *   → Events sent over network to Kafka cluster
 *   → Consumers can be in different containers/machines
 *
 * Otherwise (monolith, or not set):
 *   → Return InMemoryEventBus
 *   → Events handled in-memory, same process
 *   → No external dependencies needed
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
let eventBusInstance = null;

function getEventBus() {
    /**
     * Singleton: return existing instance if already created
     */
    if (eventBusInstance) {
        return eventBusInstance;
    }

    /**
     * Read deployment mode from environment
     */
    const deploymentMode = (process.env.DEPLOYMENT_MODE || 'monolith').toLowerCase();

    /**
     * Create appropriate event bus based on mode
     */
    if (deploymentMode === 'microservices') {
        logger.info('Initializing EventBus in MICROSERVICES mode', {
            component: 'eventbus',
            operation: 'factory',
            mode: 'microservices',
            message: 'Using Kafka for distributed messaging'
        });
        eventBusInstance = new KafkaEventBus();
    } else {
        logger.info('Initializing EventBus in MONOLITH mode', {
            component: 'eventbus',
            operation: 'factory',
            mode: 'monolith',
            message: 'Using in-memory EventEmitter'
        });
        eventBusInstance = new InMemoryEventBus();
    }

    return eventBusInstance;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GRACEFUL SHUTDOWN HANDLER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Registers handlers for process termination signals
 *
 * When Node.js receives SIGTERM or SIGINT (Ctrl+C):
 * 1. Stop accepting new messages
 * 2. Finish processing current messages
 * 3. Disconnect from Kafka/close EventEmitter
 * 4. Exit process
 *
 * This prevents data loss during shutdown!
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
const setupGracefulShutdown = () => {
    const shutdown = async (signal) => {
        logger.info(`Received ${signal}, shutting down gracefully...`, {
            component: 'eventbus',
            operation: 'shutdown',
            signal: signal
        });

        if (eventBusInstance) {
            try {
                await eventBusInstance.close();
            } catch (error) {
                logger.error('Error during graceful shutdown', {
                    component: 'eventbus',
                    operation: 'shutdown',
                    error: {
                        message: error.message
                    }
                });
            }
        }

        process.exit(0);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};

// Setup shutdown handlers when module loads
setupGracefulShutdown();

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXPORTS
 * ═══════════════════════════════════════════════════════════════════════════
 */
module.exports = {
    getEventBus,
    InMemoryEventBus,  // Exported for testing
    KafkaEventBus      // Exported for testing
};
