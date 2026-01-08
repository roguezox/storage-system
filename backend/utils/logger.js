const winston = require('winston');
const Transport = require('winston-transport');
const { Kafka, logLevel } = require('kafkajs');

/**
 * Custom Kafka Transport for Winston
 * Sends logs to Confluent Cloud Kafka
 */
class KafkaTransport extends Transport {
    constructor(opts = {}) {
        super(opts);

        this.topic = opts.topic || 'storage-system-logs';
        this.kafkaEnabled = opts.enabled !== false;

        if (!this.kafkaEnabled) {
            return;
        }

        // Initialize Kafka client for Confluent Cloud
        const kafka = new Kafka({
            clientId: opts.clientId || 'storage-system-backend',
            brokers: opts.brokers || [process.env.KAFKA_BOOTSTRAP_SERVERS],
            ssl: true,
            sasl: {
                mechanism: 'plain',
                username: process.env.KAFKA_API_KEY,
                password: process.env.KAFKA_API_SECRET,
            },
            logLevel: logLevel.ERROR, // Only log Kafka errors to avoid log loops
        });

        this.producer = kafka.producer({
            allowAutoTopicCreation: false,
            transactionTimeout: 30000,
        });

        this.producerReady = false;
        this.messageQueue = [];

        // Connect producer asynchronously
        this.producer.connect()
            .then(() => {
                this.producerReady = true;
                console.log('✅ Kafka producer connected to Confluent Cloud');
                // Flush queued messages
                this._flushQueue();
            })
            .catch(err => {
                console.error('❌ Kafka producer connection failed:', err.message);
                this.kafkaEnabled = false;
            });

        // Handle graceful shutdown
        process.on('SIGINT', () => this._disconnect());
        process.on('SIGTERM', () => this._disconnect());
    }

    log(info, callback) {
        setImmediate(() => {
            this.emit('logged', info);
        });

        if (!this.kafkaEnabled) {
            callback();
            return;
        }

        // Determine topic based on log level
        let topic = this.topic;
        if (info.level === 'error' || info.level === 'warn') {
            topic = `${this.topic}-critical`;
        } else if (info.level === 'info') {
            topic = `${this.topic}-info`;
        } else if (info.level === 'debug') {
            topic = `${this.topic}-debug`;
        }

        const message = {
            topic,
            messages: [{
                key: info.component || 'general',
                value: JSON.stringify({
                    ...info,
                    timestamp: info.timestamp || new Date().toISOString(),
                    service: 'storage-system-backend',
                    environment: process.env.NODE_ENV || 'production',
                }),
            }],
        };

        if (this.producerReady) {
            this.producer.send(message)
                .catch(err => {
                    console.error('Failed to send log to Kafka:', err.message);
                });
        } else {
            // Queue messages until producer is ready
            this.messageQueue.push(message);
        }

        callback();
    }

    _flushQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.producer.send(message)
                .catch(err => {
                    console.error('Failed to send queued log to Kafka:', err.message);
                });
        }
    }

    async _disconnect() {
        if (this.producer && this.producerReady) {
            try {
                await this.producer.disconnect();
                console.log('✅ Kafka producer disconnected');
            } catch (err) {
                console.error('Error disconnecting Kafka producer:', err.message);
            }
        }
    }
}

/**
 * Create Winston Logger with Console and Kafka transports
 */
function createLogger() {
    const transports = [
        // Console transport (always enabled)
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                    return `${timestamp} [${level}]: ${message} ${metaStr}`;
                })
            ),
        }),
    ];

    // Add Kafka transport if configured
    const kafkaEnabled = process.env.KAFKA_ENABLED !== 'false' &&
                         process.env.KAFKA_BOOTSTRAP_SERVERS &&
                         process.env.KAFKA_API_KEY &&
                         process.env.KAFKA_API_SECRET;

    if (kafkaEnabled) {
        transports.push(
            new KafkaTransport({
                topic: process.env.KAFKA_TOPIC || 'storage-system-logs',
                enabled: true,
            })
        );
    } else {
        console.warn('⚠️  Kafka logging disabled (missing configuration)');
    }

    const logger = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
        ),
        transports,
        exitOnError: false,
    });

    return logger;
}

// Create singleton logger instance
const logger = createLogger();

module.exports = logger;
