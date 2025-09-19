const winston = require('winston');
const path = require('path');

/**
 * Centralized logging utility for the AI Phone Gateway system
 */
class Logger {
    constructor(module = 'System') {
        this.module = module;
        this.logger = this.createLogger();
    }

    createLogger() {
        // Create logs directory if it doesn't exist
        const logDir = path.join(process.cwd(), 'logs');
        
        const logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss.SSS'
                }),
                winston.format.errors({ stack: true }),
                winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
                    let log = `${timestamp} [${this.module}] ${level.toUpperCase()}: ${message}`;
                    
                    // Add metadata if present
                    if (Object.keys(meta).length > 0) {
                        log += ` ${JSON.stringify(meta)}`;
                    }
                    
                    // Add stack trace for errors
                    if (stack) {
                        log += `\n${stack}`;
                    }
                    
                    return log;
                })
            ),
            transports: [
                // Console output
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.printf(({ level, message, timestamp, ...meta }) => {
                            let log = `${timestamp} [${this.module}] ${level}: ${message}`;
                            
                            if (Object.keys(meta).length > 0) {
                                log += ` ${JSON.stringify(meta, null, 2)}`;
                            }
                            
                            return log;
                        })
                    )
                }),
                
                // File output for all logs
                new winston.transports.File({
                    filename: path.join(logDir, 'application.log'),
                    format: winston.format.combine(
                        winston.format.uncolorize(),
                        winston.format.json()
                    ),
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 5,
                    tailable: true
                }),
                
                // Separate file for errors
                new winston.transports.File({
                    filename: path.join(logDir, 'error.log'),
                    level: 'error',
                    format: winston.format.combine(
                        winston.format.uncolorize(),
                        winston.format.json()
                    ),
                    maxsize: 5 * 1024 * 1024, // 5MB
                    maxFiles: 5,
                    tailable: true
                })
            ],
            
            // Handle uncaught exceptions
            exceptionHandlers: [
                new winston.transports.File({
                    filename: path.join(logDir, 'exceptions.log')
                })
            ],
            
            // Handle unhandled promise rejections
            rejectionHandlers: [
                new winston.transports.File({
                    filename: path.join(logDir, 'rejections.log')
                })
            ]
        });

        return logger;
    }

    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    error(message, meta = {}) {
        this.logger.error(message, meta);
    }

    fatal(message, meta = {}) {
        this.logger.error(`FATAL: ${message}`, meta);
    }

    // Performance logging
    time(label) {
        console.time(`[${this.module}] ${label}`);
    }

    timeEnd(label) {
        console.timeEnd(`[${this.module}] ${label}`);
    }

    // Structured logging for specific events
    logEvent(eventType, data = {}) {
        this.logger.info(`EVENT: ${eventType}`, {
            eventType,
            timestamp: new Date().toISOString(),
            ...data
        });
    }

    // Audit logging for security events
    audit(action, user, resource, result, details = {}) {
        this.logger.info(`AUDIT: ${action}`, {
            auditType: 'security',
            action,
            user,
            resource,
            result,
            timestamp: new Date().toISOString(),
            ...details
        });
    }

    // Performance metrics logging
    metric(metricName, value, unit = '', tags = {}) {
        this.logger.info(`METRIC: ${metricName}`, {
            metricType: 'performance',
            metricName,
            value,
            unit,
            tags,
            timestamp: new Date().toISOString()
        });
    }

    // Business logic logging
    business(operation, status, data = {}) {
        this.logger.info(`BUSINESS: ${operation}`, {
            businessType: 'operation',
            operation,
            status,
            timestamp: new Date().toISOString(),
            ...data
        });
    }

    // Create child logger with additional context
    child(context = {}) {
        const childLogger = new Logger(`${this.module}:${context.component || 'Child'}`);
        
        // Add context to all log messages
        const originalMethods = ['debug', 'info', 'warn', 'error'];
        originalMethods.forEach(method => {
            const originalMethod = childLogger[method].bind(childLogger);
            childLogger[method] = (message, meta = {}) => {
                originalMethod(message, { ...context, ...meta });
            };
        });
        
        return childLogger;
    }

    // Set log level dynamically
    setLevel(level) {
        this.logger.level = level;
        this.logger.info(`Log level changed to: ${level}`);
    }

    // Get current log level
    getLevel() {
        return this.logger.level;
    }

    // Create a request correlation logger
    correlate(correlationId) {
        return this.child({ correlationId });
    }

    // Log with different severity levels
    trace(message, meta = {}) {
        this.debug(message, { ...meta, severity: 'trace' });
    }

    verbose(message, meta = {}) {
        this.debug(message, { ...meta, severity: 'verbose' });
    }

    // Log system health information
    health(component, status, metrics = {}) {
        this.info(`HEALTH: ${component}`, {
            healthType: 'component',
            component,
            status,
            metrics,
            timestamp: new Date().toISOString()
        });
    }

    // Log API requests/responses
    api(method, url, statusCode, responseTime, userId = null) {
        this.info(`API: ${method} ${url}`, {
            apiType: 'request',
            method,
            url,
            statusCode,
            responseTime,
            userId,
            timestamp: new Date().toISOString()
        });
    }

    // Log database operations
    database(operation, table, duration, rowsAffected = null) {
        this.info(`DB: ${operation} ${table}`, {
            databaseType: 'operation',
            operation,
            table,
            duration,
            rowsAffected,
            timestamp: new Date().toISOString()
        });
    }

    // Log external service calls
    external(service, operation, duration, success, error = null) {
        this.info(`EXTERNAL: ${service}`, {
            externalType: 'service_call',
            service,
            operation,
            duration,
            success,
            error: error ? error.message : null,
            timestamp: new Date().toISOString()
        });
    }

    // Log user actions
    userAction(userId, action, resource, result, metadata = {}) {
        this.info(`USER_ACTION: ${action}`, {
            userActionType: 'activity',
            userId,
            action,
            resource,
            result,
            metadata,
            timestamp: new Date().toISOString()
        });
    }

    // Log system errors with context
    systemError(error, context = {}) {
        this.error('System Error', {
            errorType: 'system',
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        });
    }

    // Log validation errors
    validationError(field, value, rule, message) {
        this.warn(`VALIDATION: ${field}`, {
            validationType: 'field_validation',
            field,
            value,
            rule,
            message,
            timestamp: new Date().toISOString()
        });
    }

    // Log rate limiting events
    rateLimited(identifier, limit, window, current) {
        this.warn(`RATE_LIMITED: ${identifier}`, {
            rateLimitType: 'limit_exceeded',
            identifier,
            limit,
            window,
            current,
            timestamp: new Date().toISOString()
        });
    }

    // Log cache operations
    cache(operation, key, hit, duration = null) {
        this.debug(`CACHE: ${operation} ${key}`, {
            cacheType: 'operation',
            operation,
            key,
            hit,
            duration,
            timestamp: new Date().toISOString()
        });
    }

    // Log configuration changes
    configChange(component, parameter, oldValue, newValue, changedBy) {
        this.info(`CONFIG_CHANGE: ${component}.${parameter}`, {
            configType: 'change',
            component,
            parameter,
            oldValue,
            newValue,
            changedBy,
            timestamp: new Date().toISOString()
        });
    }

    // Log AI model operations
    aiModel(model, operation, inputSize, outputSize, duration, accuracy = null) {
        this.info(`AI_MODEL: ${model}`, {
            aiType: 'model_operation',
            model,
            operation,
            inputSize,
            outputSize,
            duration,
            accuracy,
            timestamp: new Date().toISOString()
        });
    }

    // Log network events
    network(event, source, destination, protocol, bytes = null) {
        this.debug(`NETWORK: ${event}`, {
            networkType: 'event',
            event,
            source,
            destination,
            protocol,
            bytes,
            timestamp: new Date().toISOString()
        });
    }

    // Log security events
    security(event, severity, details = {}) {
        const logMethod = severity === 'critical' ? 'error' : 
                         severity === 'high' ? 'warn' : 'info';
        
        this[logMethod](`SECURITY: ${event}`, {
            securityType: 'event',
            event,
            severity,
            details,
            timestamp: new Date().toISOString()
        });
    }

    // Cleanup method
    destroy() {
        this.logger.destroy();
    }
}

module.exports = Logger;