const yaml = require('yaml');
const fs = require('fs');
const path = require('path');
const Joi = require('joi');
const Logger = require('./logger');

/**
 * Configuration Manager for the AI Phone Gateway system
 * Handles loading, validation, and management of configuration settings
 */
class ConfigManager {
    constructor(configPath = null) {
        this.logger = new Logger('ConfigManager');
        this.config = {};
        this.configPath = configPath || this.findConfigFile();
        this.watchers = [];
        this.schema = this.defineConfigSchema();
        
        this.loadConfiguration();
        this.validateConfiguration();
    }

    findConfigFile() {
        // Look for configuration files in order of preference
        const possiblePaths = [
            process.env.CONFIG_PATH,
            path.join(process.cwd(), 'config', 'production.yml'),
            path.join(process.cwd(), 'config', 'development.yml'),
            path.join(process.cwd(), 'config', 'default.yml'),
            path.join(process.cwd(), 'config.yml'),
            path.join(process.cwd(), 'config.json')
        ].filter(Boolean);

        for (const configPath of possiblePaths) {
            if (fs.existsSync(configPath)) {
                this.logger.info(`Found configuration file: ${configPath}`);
                return configPath;
            }
        }

        // If no config file found, create default configuration
        return this.createDefaultConfig();
    }

    createDefaultConfig() {
        const defaultConfigPath = path.join(process.cwd(), 'config', 'default.yml');
        
        // Ensure config directory exists
        const configDir = path.dirname(defaultConfigPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        const defaultConfig = this.getDefaultConfiguration();
        
        try {
            fs.writeFileSync(defaultConfigPath, yaml.stringify(defaultConfig));
            this.logger.info(`Created default configuration file: ${defaultConfigPath}`);
            return defaultConfigPath;
        } catch (error) {
            this.logger.error('Failed to create default configuration file:', error);
            throw error;
        }
    }

    getDefaultConfiguration() {
        return {
            server: {
                port: 3000,
                host: '0.0.0.0',
                environment: 'development'
            },
            
            logging: {
                level: 'info',
                enableConsole: true,
                enableFile: true,
                maxFileSize: '10MB',
                maxFiles: 5
            },
            
            phoneServer: {
                callRouting: {
                    modelPath: './models/call-routing-model.json',
                    confidenceThreshold: 0.8,
                    routingRules: {},
                    maxRoutingTime: 5000
                },
                
                voiceProcessing: {
                    modelPath: './models/voice-model.json',
                    sampleRate: 16000,
                    languageModels: ['en-US', 'es-ES', 'fr-FR'],
                    confidenceThreshold: 0.7,
                    maxAudioLength: 30
                },
                
                fraudDetection: {
                    modelPath: './models/fraud-detection-model.json',
                    riskThreshold: 0.7,
                    blacklistPath: './data/blacklist.json',
                    whitelistPath: './data/whitelist.json',
                    maxCallDuration: 3600,
                    maxCallsPerHour: 50
                },
                
                maintenance: {
                    modelPath: './models/maintenance-model.json',
                    monitoringInterval: 60000,
                    alertThreshold: 0.7,
                    criticalThreshold: 0.9,
                    metricsHistorySize: 1440
                }
            },
            
            internetGateway: {
                trafficManagement: {
                    modelPath: './models/traffic-model.json',
                    optimizationInterval: 30000,
                    bandwidthThreshold: 0.8,
                    latencyThreshold: 100,
                    maxConnections: 10000
                },
                
                threatDetection: {
                    modelPath: './models/threat-detection-model.json',
                    scanInterval: 10000,
                    threatThreshold: 0.8,
                    criticalThreshold: 0.95,
                    whitelistPath: './data/ip-whitelist.json',
                    blacklistPath: './data/ip-blacklist.json',
                    maxLogEntries: 10000
                },
                
                qosOptimization: {
                    modelPath: './models/qos-model.json',
                    optimizationInterval: 15000,
                    learningRate: 0.001,
                    explorationRate: 0.1,
                    rewardThreshold: 0.8
                },
                
                selfHealing: {
                    modelPath: './models/self-healing-model.json',
                    monitoringInterval: 30000,
                    healingThreshold: 0.7,
                    criticalThreshold: 0.9,
                    maxHealingAttempts: 3,
                    healingCooldown: 300000
                }
            },
            
            database: {
                host: 'localhost',
                port: 5432,
                name: 'ai_phone_gateway',
                username: 'postgres',
                password: 'password',
                ssl: false,
                pool: {
                    min: 2,
                    max: 10,
                    acquireTimeoutMillis: 30000,
                    idleTimeoutMillis: 30000
                }
            },
            
            redis: {
                host: 'localhost',
                port: 6379,
                password: null,
                db: 0,
                keyPrefix: 'ai_gateway:',
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3
            },
            
            security: {
                jwtSecret: 'your-secret-key-change-this-in-production',
                jwtExpiresIn: '24h',
                bcryptRounds: 10,
                rateLimiting: {
                    windowMs: 900000, // 15 minutes
                    max: 100 // requests per window
                },
                cors: {
                    origin: ['http://localhost:3000'],
                    credentials: true
                }
            },
            
            ai: {
                tensorflow: {
                    backend: 'cpu',
                    enableProfiling: false,
                    memoryGrowth: true
                },
                models: {
                    autoSave: true,
                    saveInterval: 3600000, // 1 hour
                    backupCount: 5
                },
                training: {
                    batchSize: 32,
                    learningRate: 0.001,
                    epochs: 100,
                    validationSplit: 0.2
                }
            },
            
            monitoring: {
                enabled: true,
                interval: 30000,
                metrics: {
                    system: true,
                    application: true,
                    business: true
                },
                alerts: {
                    email: {
                        enabled: false,
                        smtp: {
                            host: 'smtp.gmail.com',
                            port: 587,
                            secure: false,
                            auth: {
                                user: 'your-email@gmail.com',
                                pass: 'your-password'
                            }
                        },
                        recipients: ['admin@example.com']
                    },
                    webhook: {
                        enabled: false,
                        url: 'https://hooks.slack.com/services/...'
                    }
                }
            },
            
            telephony: {
                twilio: {
                    accountSid: 'your-twilio-account-sid',
                    authToken: 'your-twilio-auth-token',
                    phoneNumber: 'your-twilio-phone-number'
                },
                asterisk: {
                    enabled: false,
                    host: 'localhost',
                    port: 5038,
                    username: 'admin',
                    password: 'secret'
                }
            }
        };
    }

    defineConfigSchema() {
        return Joi.object({
            server: Joi.object({
                port: Joi.number().port().required(),
                host: Joi.string().required(),
                environment: Joi.string().valid('development', 'testing', 'production').required()
            }).required(),
            
            logging: Joi.object({
                level: Joi.string().valid('error', 'warn', 'info', 'debug').required(),
                enableConsole: Joi.boolean().required(),
                enableFile: Joi.boolean().required(),
                maxFileSize: Joi.string().required(),
                maxFiles: Joi.number().min(1).required()
            }).required(),
            
            phoneServer: Joi.object({
                callRouting: Joi.object({
                    modelPath: Joi.string().required(),
                    confidenceThreshold: Joi.number().min(0).max(1).required(),
                    routingRules: Joi.object().required(),
                    maxRoutingTime: Joi.number().min(1000).required()
                }).required(),
                
                voiceProcessing: Joi.object({
                    modelPath: Joi.string().required(),
                    sampleRate: Joi.number().min(8000).required(),
                    languageModels: Joi.array().items(Joi.string()).required(),
                    confidenceThreshold: Joi.number().min(0).max(1).required(),
                    maxAudioLength: Joi.number().min(1).required()
                }).required(),
                
                fraudDetection: Joi.object({
                    modelPath: Joi.string().required(),
                    riskThreshold: Joi.number().min(0).max(1).required(),
                    blacklistPath: Joi.string().required(),
                    whitelistPath: Joi.string().required(),
                    maxCallDuration: Joi.number().min(60).required(),
                    maxCallsPerHour: Joi.number().min(1).required()
                }).required(),
                
                maintenance: Joi.object({
                    modelPath: Joi.string().required(),
                    monitoringInterval: Joi.number().min(10000).required(),
                    alertThreshold: Joi.number().min(0).max(1).required(),
                    criticalThreshold: Joi.number().min(0).max(1).required(),
                    metricsHistorySize: Joi.number().min(100).required()
                }).required()
            }).required(),
            
            internetGateway: Joi.object({
                trafficManagement: Joi.object({
                    modelPath: Joi.string().required(),
                    optimizationInterval: Joi.number().min(5000).required(),
                    bandwidthThreshold: Joi.number().min(0).max(1).required(),
                    latencyThreshold: Joi.number().min(10).required(),
                    maxConnections: Joi.number().min(100).required()
                }).required(),
                
                threatDetection: Joi.object({
                    modelPath: Joi.string().required(),
                    scanInterval: Joi.number().min(1000).required(),
                    threatThreshold: Joi.number().min(0).max(1).required(),
                    criticalThreshold: Joi.number().min(0).max(1).required(),
                    whitelistPath: Joi.string().required(),
                    blacklistPath: Joi.string().required(),
                    maxLogEntries: Joi.number().min(1000).required()
                }).required(),
                
                qosOptimization: Joi.object({
                    modelPath: Joi.string().required(),
                    optimizationInterval: Joi.number().min(5000).required(),
                    learningRate: Joi.number().min(0.0001).max(0.1).required(),
                    explorationRate: Joi.number().min(0).max(1).required(),
                    rewardThreshold: Joi.number().min(0).max(1).required()
                }).required(),
                
                selfHealing: Joi.object({
                    modelPath: Joi.string().required(),
                    monitoringInterval: Joi.number().min(10000).required(),
                    healingThreshold: Joi.number().min(0).max(1).required(),
                    criticalThreshold: Joi.number().min(0).max(1).required(),
                    maxHealingAttempts: Joi.number().min(1).max(10).required(),
                    healingCooldown: Joi.number().min(60000).required()
                }).required()
            }).required(),
            
            database: Joi.object({
                host: Joi.string().required(),
                port: Joi.number().port().required(),
                name: Joi.string().required(),
                username: Joi.string().required(),
                password: Joi.string().allow('').required(),
                ssl: Joi.boolean().required(),
                pool: Joi.object({
                    min: Joi.number().min(1).required(),
                    max: Joi.number().min(1).required(),
                    acquireTimeoutMillis: Joi.number().min(1000).required(),
                    idleTimeoutMillis: Joi.number().min(1000).required()
                }).required()
            }).required(),
            
            redis: Joi.object({
                host: Joi.string().required(),
                port: Joi.number().port().required(),
                password: Joi.string().allow(null),
                db: Joi.number().min(0).max(15).required(),
                keyPrefix: Joi.string().required(),
                retryDelayOnFailover: Joi.number().min(50).required(),
                maxRetriesPerRequest: Joi.number().min(1).required()
            }).required(),
            
            security: Joi.object({
                jwtSecret: Joi.string().min(32).required(),
                jwtExpiresIn: Joi.string().required(),
                bcryptRounds: Joi.number().min(8).max(15).required(),
                rateLimiting: Joi.object({
                    windowMs: Joi.number().min(60000).required(),
                    max: Joi.number().min(1).required()
                }).required(),
                cors: Joi.object({
                    origin: Joi.array().items(Joi.string()).required(),
                    credentials: Joi.boolean().required()
                }).required()
            }).required(),
            
            ai: Joi.object({
                tensorflow: Joi.object({
                    backend: Joi.string().valid('cpu', 'gpu').required(),
                    enableProfiling: Joi.boolean().required(),
                    memoryGrowth: Joi.boolean().required()
                }).required(),
                models: Joi.object({
                    autoSave: Joi.boolean().required(),
                    saveInterval: Joi.number().min(60000).required(),
                    backupCount: Joi.number().min(1).required()
                }).required(),
                training: Joi.object({
                    batchSize: Joi.number().min(1).required(),
                    learningRate: Joi.number().min(0.0001).max(0.1).required(),
                    epochs: Joi.number().min(1).required(),
                    validationSplit: Joi.number().min(0).max(0.5).required()
                }).required()
            }).required(),
            
            monitoring: Joi.object({
                enabled: Joi.boolean().required(),
                interval: Joi.number().min(10000).required(),
                metrics: Joi.object({
                    system: Joi.boolean().required(),
                    application: Joi.boolean().required(),
                    business: Joi.boolean().required()
                }).required(),
                alerts: Joi.object({
                    email: Joi.object({
                        enabled: Joi.boolean().required(),
                        smtp: Joi.object({
                            host: Joi.string(),
                            port: Joi.number().port(),
                            secure: Joi.boolean(),
                            auth: Joi.object({
                                user: Joi.string(),
                                pass: Joi.string()
                            })
                        }),
                        recipients: Joi.array().items(Joi.string().email())
                    }).required(),
                    webhook: Joi.object({
                        enabled: Joi.boolean().required(),
                        url: Joi.string().uri()
                    }).required()
                }).required()
            }).required(),
            
            telephony: Joi.object({
                twilio: Joi.object({
                    accountSid: Joi.string(),
                    authToken: Joi.string(),
                    phoneNumber: Joi.string()
                }),
                asterisk: Joi.object({
                    enabled: Joi.boolean().required(),
                    host: Joi.string(),
                    port: Joi.number().port(),
                    username: Joi.string(),
                    password: Joi.string()
                })
            }).required()
        });
    }

    loadConfiguration() {
        try {
            if (!fs.existsSync(this.configPath)) {
                throw new Error(`Configuration file not found: ${this.configPath}`);
            }

            const fileContent = fs.readFileSync(this.configPath, 'utf8');
            const fileExtension = path.extname(this.configPath).toLowerCase();

            if (fileExtension === '.yml' || fileExtension === '.yaml') {
                this.config = yaml.parse(fileContent);
            } else if (fileExtension === '.json') {
                this.config = JSON.parse(fileContent);
            } else {
                throw new Error(`Unsupported configuration file format: ${fileExtension}`);
            }

            // Apply environment variable overrides
            this.applyEnvironmentOverrides();

            this.logger.info(`Configuration loaded from: ${this.configPath}`);
        } catch (error) {
            this.logger.error('Failed to load configuration:', error);
            throw error;
        }
    }

    applyEnvironmentOverrides() {
        // Apply environment variable overrides
        const envMappings = {
            'PORT': 'server.port',
            'HOST': 'server.host',
            'NODE_ENV': 'server.environment',
            'LOG_LEVEL': 'logging.level',
            'DB_HOST': 'database.host',
            'DB_PORT': 'database.port',
            'DB_NAME': 'database.name',
            'DB_USER': 'database.username',
            'DB_PASSWORD': 'database.password',
            'REDIS_HOST': 'redis.host',
            'REDIS_PORT': 'redis.port',
            'REDIS_PASSWORD': 'redis.password',
            'JWT_SECRET': 'security.jwtSecret',
            'TWILIO_ACCOUNT_SID': 'telephony.twilio.accountSid',
            'TWILIO_AUTH_TOKEN': 'telephony.twilio.authToken',
            'TWILIO_PHONE_NUMBER': 'telephony.twilio.phoneNumber'
        };

        Object.entries(envMappings).forEach(([envVar, configPath]) => {
            const envValue = process.env[envVar];
            if (envValue !== undefined) {
                this.setNestedValue(this.config, configPath, this.parseEnvironmentValue(envValue));
                this.logger.debug(`Applied environment override: ${envVar} -> ${configPath}`);
            }
        });
    }

    parseEnvironmentValue(value) {
        // Try to parse as number
        if (/^\d+$/.test(value)) {
            return parseInt(value, 10);
        }
        
        // Try to parse as float
        if (/^\d+\.\d+$/.test(value)) {
            return parseFloat(value);
        }
        
        // Try to parse as boolean
        if (value.toLowerCase() === 'true') {
            return true;
        }
        if (value.toLowerCase() === 'false') {
            return false;
        }
        
        // Return as string
        return value;
    }

    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }

    validateConfiguration() {
        try {
            const { error, value } = this.schema.validate(this.config, {
                allowUnknown: true,
                abortEarly: false
            });

            if (error) {
                const errorMessages = error.details.map(detail => detail.message).join(', ');
                throw new Error(`Configuration validation failed: ${errorMessages}`);
            }

            this.config = value;
            this.logger.info('Configuration validation passed');
        } catch (error) {
            this.logger.error('Configuration validation failed:', error);
            throw error;
        }
    }

    get(path, defaultValue = undefined) {
        return this.getNestedValue(this.config, path) ?? defaultValue;
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    set(path, value) {
        this.setNestedValue(this.config, path, value);
        this.logger.info(`Configuration updated: ${path} = ${JSON.stringify(value)}`);
    }

    has(path) {
        return this.getNestedValue(this.config, path) !== undefined;
    }

    getAll() {
        return JSON.parse(JSON.stringify(this.config));
    }

    reload() {
        this.logger.info('Reloading configuration...');
        this.loadConfiguration();
        this.validateConfiguration();
        this.notifyWatchers('reload');
    }

    watch(callback) {
        this.watchers.push(callback);
        
        // Set up file watcher
        if (fs.existsSync(this.configPath)) {
            fs.watchFile(this.configPath, (curr, prev) => {
                if (curr.mtime > prev.mtime) {
                    this.logger.info('Configuration file changed, reloading...');
                    try {
                        this.reload();
                    } catch (error) {
                        this.logger.error('Failed to reload configuration:', error);
                    }
                }
            });
        }
        
        return () => {
            const index = this.watchers.indexOf(callback);
            if (index > -1) {
                this.watchers.splice(index, 1);
            }
        };
    }

    notifyWatchers(event) {
        this.watchers.forEach(callback => {
            try {
                callback(event, this.config);
            } catch (error) {
                this.logger.error('Configuration watcher callback failed:', error);
            }
        });
    }

    save(configPath = null) {
        const savePath = configPath || this.configPath;
        
        try {
            const fileExtension = path.extname(savePath).toLowerCase();
            let content;
            
            if (fileExtension === '.yml' || fileExtension === '.yaml') {
                content = yaml.stringify(this.config);
            } else if (fileExtension === '.json') {
                content = JSON.stringify(this.config, null, 2);
            } else {
                throw new Error(`Unsupported configuration file format: ${fileExtension}`);
            }
            
            // Ensure directory exists
            const dir = path.dirname(savePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(savePath, content);
            this.logger.info(`Configuration saved to: ${savePath}`);
        } catch (error) {
            this.logger.error('Failed to save configuration:', error);
            throw error;
        }
    }

    backup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${this.configPath}.backup.${timestamp}`;
        
        try {
            fs.copyFileSync(this.configPath, backupPath);
            this.logger.info(`Configuration backed up to: ${backupPath}`);
            return backupPath;
        } catch (error) {
            this.logger.error('Failed to backup configuration:', error);
            throw error;
        }
    }

    merge(partialConfig) {
        this.config = this.deepMerge(this.config, partialConfig);
        this.validateConfiguration();
        this.notifyWatchers('merge');
    }

    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    getEnvironment() {
        return this.get('server.environment', 'development');
    }

    isDevelopment() {
        return this.getEnvironment() === 'development';
    }

    isProduction() {
        return this.getEnvironment() === 'production';
    }

    isTesting() {
        return this.getEnvironment() === 'testing';
    }

    getSecrets() {
        // Return configuration with sensitive values masked
        const masked = JSON.parse(JSON.stringify(this.config));
        
        const sensitiveKeys = [
            'password', 'secret', 'token', 'key', 'auth', 'credential'
        ];
        
        this.maskSensitiveValues(masked, sensitiveKeys);
        return masked;
    }

    maskSensitiveValues(obj, sensitiveKeys) {
        Object.keys(obj).forEach(key => {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                this.maskSensitiveValues(obj[key], sensitiveKeys);
            } else if (typeof obj[key] === 'string') {
                const isSensitive = sensitiveKeys.some(sensitiveKey => 
                    key.toLowerCase().includes(sensitiveKey.toLowerCase())
                );
                
                if (isSensitive) {
                    obj[key] = '*'.repeat(8);
                }
            }
        });
    }

    destroy() {
        // Cleanup watchers
        fs.unwatchFile(this.configPath);
        this.watchers = [];
        
        this.logger.info('Configuration manager destroyed');
    }
}

module.exports = ConfigManager;