const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * HTTP Request/Response Logging Middleware
 * Logs all incoming requests and outgoing responses with metadata
 */
function requestLogger(req, res, next) {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    // Attach requestId to request for tracing
    req.requestId = requestId;

    // Capture original res.send to log after response
    const originalSend = res.send;
    let responseBody;

    res.send = function(data) {
        responseBody = data;
        originalSend.call(this, data);
    };

    // Log when response finishes
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

        const logData = {
            component: 'http',
            operation: 'request',
            requestId,
            method: req.method,
            path: req.path,
            query: req.query,
            statusCode: res.statusCode,
            duration,
            userId: req.userId ? req.userId.toString() : 'anonymous',
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            contentLength: res.get('Content-Length') || 0,
            referer: req.headers['referer'] || req.headers['referrer'],
        };

        // Add error details for failed requests
        if (res.statusCode >= 400 && res.locals.error) {
            logData.error = {
                message: res.locals.error.message,
                stack: res.locals.error.stack,
            };
        }

        logger.log(logLevel, 'HTTP request completed', logData);
    });

    next();
}

module.exports = requestLogger;
