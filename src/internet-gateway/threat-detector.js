const tf = require('@tensorflow/tfjs');
const EventEmitter = require('events');
const Logger = require('../shared/logger');

/**
 * AI-Powered Threat Detection and Response System
 * Real-time cyber threat detection and automated mitigation
 */
class ThreatDetector extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            modelPath: config.modelPath || './models/threat-detection-model.json',
            scanInterval: config.scanInterval || 10000, // 10 seconds
            threatThreshold: config.threatThreshold || 0.8,
            criticalThreshold: config.criticalThreshold || 0.95,
            whitelistPath: config.whitelistPath || './data/ip-whitelist.json',
            blacklistPath: config.blacklistPath || './data/ip-blacklist.json',
            maxLogEntries: config.maxLogEntries || 10000,
            ...config
        };
        
        this.logger = new Logger('ThreatDetector');
        this.model = null;
        this.isInitialized = false;
        this.isScanning = false;
        
        // Threat databases
        this.knownThreatSignatures = new Map();
        this.ipWhitelist = new Set();
        this.ipBlacklist = new Set();
        this.suspiciousIPs = new Map();
        
        // Network monitoring data
        this.networkLogs = [];
        this.activeConnections = new Map();
        this.threatHistory = [];
        
        // Threat categories and their indicators
        this.threatCategories = {
            'ddos': { weight: 0.9, indicators: ['high_connection_rate', 'bandwidth_spike', 'syn_flood'] },
            'port_scan': { weight: 0.7, indicators: ['multiple_ports', 'sequential_scan', 'failed_connections'] },
            'brute_force': { weight: 0.8, indicators: ['repeated_failures', 'credential_attempts', 'rapid_requests'] },
            'malware': { weight: 0.95, indicators: ['known_signatures', 'suspicious_payload', 'c2_communication'] },
            'intrusion': { weight: 0.85, indicators: ['privilege_escalation', 'unauthorized_access', 'data_exfiltration'] },
            'botnet': { weight: 0.8, indicators: ['coordinated_activity', 'c2_beacons', 'distributed_source'] }
        };
        
        this.metrics = {
            totalScans: 0,
            threatsDetected: 0,
            falsePositives: 0,
            blockedAttacks: 0,
            averageResponseTime: 0
        };
    }

    async initialize() {
        try {
            this.logger.info('Initializing Threat Detection System...');
            
            // Load threat detection model
            await this.loadThreatModel();
            
            // Load threat signatures and IP lists
            await this.loadThreatData();
            
            // Start network monitoring
            this.startNetworkMonitoring();
            
            // Start threat scanning
            this.startThreatScanning();
            
            this.isInitialized = true;
            this.logger.info('Threat Detection System initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Threat Detector:', error);
            throw error;
        }
    }

    async loadThreatModel() {
        try {
            // Try to load existing model
            this.model = await tf.loadLayersModel(`file://${this.config.modelPath}`);
            this.logger.info('Loaded existing threat detection model');
        } catch (error) {
            // Create new model if none exists
            this.logger.info('Creating new threat detection model...');
            this.model = this.createThreatModel();
            await this.trainThreatModel();
        }
    }

    createThreatModel() {
        // Multi-class neural network for threat classification
        const model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [18], // Network features
                    units: 128,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({
                    units: 64,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 32,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: Object.keys(this.threatCategories).length + 1, // +1 for benign traffic
                    activation: 'softmax'
                })
            ]
        });

        model.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy', 'precision', 'recall']
        });

        return model;
    }

    async trainThreatModel() {
        // Generate training data for threat detection
        const trainingData = this.generateThreatTrainingData(5000);
        
        const xs = tf.tensor2d(trainingData.features);
        const ys = tf.tensor2d(trainingData.labels);

        await this.model.fit(xs, ys, {
            epochs: 100,
            batchSize: 64,
            validationSplit: 0.2,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    if (epoch % 20 === 0) {
                        this.logger.info(`Training epoch ${epoch}: loss=${logs.loss.toFixed(4)}, accuracy=${logs.acc.toFixed(4)}`);
                    }
                }
            }
        });

        xs.dispose();
        ys.dispose();
        
        this.logger.info('Threat detection model training completed');
    }

    generateThreatTrainingData(numSamples) {
        const features = [];
        const labels = [];
        const threatTypes = Object.keys(this.threatCategories);
        const allCategories = [...threatTypes, 'benign'];

        for (let i = 0; i < numSamples; i++) {
            const isThreat = Math.random() < 0.3; // 30% threat traffic
            let feature, threatType;
            
            if (isThreat) {
                threatType = threatTypes[Math.floor(Math.random() * threatTypes.length)];
                feature = this.generateThreatFeatures(threatType);
            } else {
                threatType = 'benign';
                feature = this.generateBenignFeatures();
            }
            
            const label = new Array(allCategories.length).fill(0);
            const typeIndex = allCategories.indexOf(threatType);
            if (typeIndex >= 0) label[typeIndex] = 1;
            
            features.push(feature);
            labels.push(label);
        }

        return { features, labels };
    }

    generateThreatFeatures(threatType) {
        const baseFeatures = this.generateBenignFeatures();
        
        switch (threatType) {
            case 'ddos':
                return [
                    Math.random() * 10000 + 1000, // Very high connection rate
                    Math.random() * 0.2, // Low packet size variance (SYN flood)
                    Math.random() * 1000000 + 100000, // High bandwidth
                    Math.random() * 0.8 + 0.2, // High failure rate
                    ...baseFeatures.slice(4)
                ];
                
            case 'port_scan':
                return [
                    Math.random() * 100 + 50, // Moderate connection rate
                    Math.random() * 0.9 + 0.1, // High port variance
                    Math.random() * 1000, // Low bandwidth
                    Math.random() * 0.9 + 0.1, // Very high failure rate
                    ...baseFeatures.slice(4)
                ];
                
            case 'brute_force':
                return [
                    Math.random() * 500 + 100, // High connection rate to specific service
                    Math.random() * 0.1, // Low port variance
                    Math.random() * 10000, // Low bandwidth
                    Math.random() * 0.8 + 0.1, // High failure rate
                    Math.random() * 0.9 + 0.1, // High repetition
                    ...baseFeatures.slice(5)
                ];
                
            case 'malware':
                return [
                    Math.random() * 50 + 10, // Moderate connection rate
                    Math.random() * 0.3, // Low port variance
                    Math.random() * 50000 + 10000, // Moderate bandwidth
                    Math.random() * 0.2, // Low failure rate
                    Math.random() * 0.1, // Low repetition
                    Math.random() * 0.9 + 0.1, // High payload entropy
                    Math.random() * 0.8 + 0.2, // Suspicious patterns
                    ...baseFeatures.slice(7)
                ];
                
            case 'intrusion':
                return [
                    Math.random() * 20 + 5, // Low connection rate
                    Math.random() * 0.4, // Moderate port variance
                    Math.random() * 5000 + 1000, // Low bandwidth
                    Math.random() * 0.3, // Low failure rate
                    Math.random() * 0.2, // Low repetition
                    Math.random() * 0.7 + 0.3, // High payload entropy
                    Math.random() * 0.9 + 0.1, // Very suspicious patterns
                    Math.random() * 0.8 + 0.2, // High privilege escalation indicators
                    ...baseFeatures.slice(8)
                ];
                
            case 'botnet':
                return [
                    Math.random() * 100 + 20, // Moderate connection rate
                    Math.random() * 0.2, // Low port variance
                    Math.random() * 20000 + 5000, // Moderate bandwidth
                    Math.random() * 0.1, // Very low failure rate
                    Math.random() * 0.1, // Low repetition
                    Math.random() * 0.5 + 0.3, // Moderate payload entropy
                    Math.random() * 0.6 + 0.2, // Moderate suspicious patterns
                    Math.random() * 0.1, // Low privilege escalation
                    Math.random() * 0.9 + 0.1, // High coordination score
                    ...baseFeatures.slice(9)
                ];
                
            default:
                return baseFeatures;
        }
    }

    generateBenignFeatures() {
        return [
            Math.random() * 50 + 1, // Normal connection rate
            Math.random() * 0.5, // Normal port variance
            Math.random() * 10000 + 100, // Normal bandwidth
            Math.random() * 0.1, // Low failure rate
            Math.random() * 0.1, // Low repetition
            Math.random() * 0.5, // Normal payload entropy
            Math.random() * 0.2, // Low suspicious patterns
            Math.random() * 0.1, // Low privilege escalation
            Math.random() * 0.1, // Low coordination
            Math.random() * 24, // Time of day
            Math.random() * 7, // Day of week
            Math.random() * 0.8, // Geographic consistency
            Math.random() * 0.9, // Protocol compliance
            Math.random() * 0.1, // Anomaly score
            Math.random() * 0.8, // Reputation score
            Math.random() * 100, // Session duration
            Math.random() * 1000, // Packet count
            Math.random() * 0.1 // Error rate
        ];
    }

    async loadThreatData() {
        try {
            const fs = require('fs').promises;
            
            // Load IP whitelist
            try {
                const whitelistData = await fs.readFile(this.config.whitelistPath, 'utf8');
                const whitelistIPs = JSON.parse(whitelistData);
                this.ipWhitelist = new Set(whitelistIPs);
                this.logger.info(`Loaded ${this.ipWhitelist.size} IPs to whitelist`);
            } catch (error) {
                this.logger.warn('No IP whitelist file found, starting with empty whitelist');
                this.ipWhitelist = new Set();
            }

            // Load IP blacklist
            try {
                const blacklistData = await fs.readFile(this.config.blacklistPath, 'utf8');
                const blacklistIPs = JSON.parse(blacklistData);
                this.ipBlacklist = new Set(blacklistIPs);
                this.logger.info(`Loaded ${this.ipBlacklist.size} IPs to blacklist`);
            } catch (error) {
                this.logger.warn('No IP blacklist file found, starting with empty blacklist');
                this.ipBlacklist = new Set();
            }

            // Load known threat signatures
            this.loadThreatSignatures();
            
        } catch (error) {
            this.logger.error('Failed to load threat data:', error);
        }
    }

    loadThreatSignatures() {
        // Common malware signatures and attack patterns
        this.knownThreatSignatures.set('wannacry', {
            ports: [445, 139],
            payloadPattern: /wannacry|wanna\s*cry/i,
            severity: 'critical'
        });
        
        this.knownThreatSignatures.set('mirai', {
            ports: [23, 2323, 7547],
            userAgents: ['Mirai', 'wget'],
            severity: 'high'
        });
        
        this.knownThreatSignatures.set('sql_injection', {
            payloadPattern: /(union|select|insert|update|delete|drop|exec|sp_|xp_)/i,
            httpMethods: ['GET', 'POST'],
            severity: 'high'
        });
        
        this.knownThreatSignatures.set('xss', {
            payloadPattern: /(<script|javascript:|onload=|onerror=)/i,
            httpMethods: ['GET', 'POST'],
            severity: 'medium'
        });
        
        this.logger.info(`Loaded ${this.knownThreatSignatures.size} threat signatures`);
    }

    startNetworkMonitoring() {
        // Simulate network traffic monitoring
        setInterval(() => {
            this.generateNetworkLogs();
        }, 1000); // Generate logs every second
        
        this.logger.info('Network monitoring started');
    }

    generateNetworkLogs() {
        // Simulate realistic network traffic logs
        const logCount = Math.floor(Math.random() * 10) + 1;
        
        for (let i = 0; i < logCount; i++) {
            const log = this.generateNetworkLog();
            this.networkLogs.push(log);
            
            // Update active connections
            this.updateActiveConnections(log);
        }
        
        // Keep only recent logs
        if (this.networkLogs.length > this.config.maxLogEntries) {
            this.networkLogs = this.networkLogs.slice(-this.config.maxLogEntries);
        }
    }

    generateNetworkLog() {
        const sourceIP = this.generateRandomIP();
        const destIP = this.generateRandomIP();
        const sourcePort = Math.floor(Math.random() * 65536);
        const destPort = this.generateRealisticPort();
        const protocol = Math.random() > 0.8 ? 'UDP' : 'TCP';
        const bytes = Math.floor(Math.random() * 10000) + 64;
        const packets = Math.floor(bytes / 1024) + 1;
        
        return {
            timestamp: Date.now(),
            sourceIP,
            destIP,
            sourcePort,
            destPort,
            protocol,
            bytes,
            packets,
            duration: Math.random() * 300 + 1, // 1-300 seconds
            flags: this.generateTCPFlags(),
            httpMethod: protocol === 'TCP' && destPort === 80 ? this.generateHTTPMethod() : null,
            userAgent: protocol === 'TCP' && destPort === 80 ? this.generateUserAgent() : null,
            payload: this.generatePayloadSample()
        };
    }

    generateRandomIP() {
        // Generate realistic IP addresses
        const privateRanges = [
            '192.168',
            '10.0',
            '172.16'
        ];
        
        if (Math.random() < 0.7) {
            // Private IP
            const range = privateRanges[Math.floor(Math.random() * privateRanges.length)];
            return `${range}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
        } else {
            // Public IP
            return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
        }
    }

    generateRealisticPort() {
        const commonPorts = [22, 23, 53, 80, 110, 143, 443, 993, 995, 3389, 5432, 3306];
        
        if (Math.random() < 0.4) {
            return commonPorts[Math.floor(Math.random() * commonPorts.length)];
        } else {
            return Math.floor(Math.random() * 65536);
        }
    }

    generateTCPFlags() {
        const flags = ['SYN', 'ACK', 'FIN', 'RST', 'PSH', 'URG'];
        const selectedFlags = [];
        
        flags.forEach(flag => {
            if (Math.random() < 0.3) {
                selectedFlags.push(flag);
            }
        });
        
        return selectedFlags;
    }

    generateHTTPMethod() {
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'];
        return methods[Math.floor(Math.random() * methods.length)];
    }

    generateUserAgent() {
        const agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'curl/7.68.0',
            'wget/1.20.3',
            'Mirai',
            'bot'
        ];
        return agents[Math.floor(Math.random() * agents.length)];
    }

    generatePayloadSample() {
        const samples = [
            'GET / HTTP/1.1',
            'POST /login HTTP/1.1',
            'SELECT * FROM users',
            '<script>alert("xss")</script>',
            'normal application data',
            'encrypted payload'
        ];
        return samples[Math.floor(Math.random() * samples.length)];
    }

    updateActiveConnections(log) {
        const connectionKey = `${log.sourceIP}:${log.sourcePort}-${log.destIP}:${log.destPort}`;
        
        if (this.activeConnections.has(connectionKey)) {
            const connection = this.activeConnections.get(connectionKey);
            connection.packets += log.packets;
            connection.bytes += log.bytes;
            connection.lastSeen = log.timestamp;
        } else {
            this.activeConnections.set(connectionKey, {
                sourceIP: log.sourceIP,
                destIP: log.destIP,
                sourcePort: log.sourcePort,
                destPort: log.destPort,
                protocol: log.protocol,
                startTime: log.timestamp,
                lastSeen: log.timestamp,
                packets: log.packets,
                bytes: log.bytes,
                flags: log.flags
            });
        }
        
        // Clean up old connections
        this.cleanupOldConnections();
    }

    cleanupOldConnections() {
        const cutoffTime = Date.now() - 300000; // 5 minutes
        
        for (const [key, connection] of this.activeConnections.entries()) {
            if (connection.lastSeen < cutoffTime) {
                this.activeConnections.delete(key);
            }
        }
    }

    startThreatScanning() {
        if (this.isScanning) return;
        
        this.isScanning = true;
        this.scanInterval = setInterval(async () => {
            try {
                await this.performThreatScan();
            } catch (error) {
                this.logger.error('Threat scanning failed:', error);
            }
        }, this.config.scanInterval);
        
        this.logger.info('Threat scanning started');
    }

    async performThreatScan() {
        if (!this.isInitialized) return;
        
        const startTime = Date.now();
        this.metrics.totalScans++;
        
        try {
            // Analyze recent network logs
            const recentLogs = this.getRecentLogs(30000); // Last 30 seconds
            
            if (recentLogs.length === 0) return;
            
            // Group logs by source IP for analysis
            const ipGroups = this.groupLogsByIP(recentLogs);
            
            const threats = [];
            
            for (const [sourceIP, logs] of ipGroups.entries()) {
                // Skip whitelisted IPs
                if (this.ipWhitelist.has(sourceIP)) continue;
                
                // Quick blacklist check
                if (this.ipBlacklist.has(sourceIP)) {
                    threats.push({
                        sourceIP,
                        threatType: 'blacklisted_ip',
                        severity: 'critical',
                        confidence: 1.0,
                        logs: logs.slice(0, 5) // Sample logs
                    });
                    continue;
                }
                
                // Rule-based detection
                const ruleBasedThreats = this.detectThreatsWithRules(sourceIP, logs);
                threats.push(...ruleBasedThreats);
                
                // AI-based detection
                const aiThreats = await this.detectThreatsWithAI(sourceIP, logs);
                threats.push(...aiThreats);
            }
            
            // Process detected threats
            for (const threat of threats) {
                await this.processThreat(threat);
            }
            
            const scanTime = Date.now() - startTime;
            this.updateScanMetrics(scanTime, threats.length);
            
            if (threats.length > 0) {
                this.emit('threatsDetected', {
                    timestamp: Date.now(),
                    scanTime,
                    threats,
                    totalLogs: recentLogs.length
                });
            }
            
        } catch (error) {
            this.logger.error('Threat scan failed:', error);
        }
    }

    getRecentLogs(timeWindow) {
        const cutoffTime = Date.now() - timeWindow;
        return this.networkLogs.filter(log => log.timestamp > cutoffTime);
    }

    groupLogsByIP(logs) {
        const groups = new Map();
        
        logs.forEach(log => {
            if (!groups.has(log.sourceIP)) {
                groups.set(log.sourceIP, []);
            }
            groups.get(log.sourceIP).push(log);
        });
        
        return groups;
    }

    detectThreatsWithRules(sourceIP, logs) {
        const threats = [];
        
        // DDoS detection
        if (logs.length > 100) { // More than 100 connections in 30 seconds
            threats.push({
                sourceIP,
                threatType: 'ddos',
                severity: 'high',
                confidence: 0.9,
                reason: `High connection rate: ${logs.length} connections in 30 seconds`,
                logs: logs.slice(0, 10)
            });
        }
        
        // Port scan detection
        const uniquePorts = new Set(logs.map(log => log.destPort));
        if (uniquePorts.size > 20) {
            threats.push({
                sourceIP,
                threatType: 'port_scan',
                severity: 'medium',
                confidence: 0.8,
                reason: `Port scanning detected: ${uniquePorts.size} unique ports accessed`,
                logs: logs.slice(0, 10)
            });
        }
        
        // Brute force detection
        const failedConnections = logs.filter(log => 
            log.flags && log.flags.includes('RST')
        );
        if (failedConnections.length > 10 && failedConnections.length / logs.length > 0.7) {
            threats.push({
                sourceIP,
                threatType: 'brute_force',
                severity: 'high',
                confidence: 0.85,
                reason: `Brute force attack: ${failedConnections.length} failed connections`,
                logs: failedConnections.slice(0, 10)
            });
        }
        
        // Malware signature detection
        for (const log of logs) {
            for (const [malwareName, signature] of this.knownThreatSignatures.entries()) {
                if (this.matchesSignature(log, signature)) {
                    threats.push({
                        sourceIP,
                        threatType: 'malware',
                        malwareType: malwareName,
                        severity: signature.severity,
                        confidence: 0.95,
                        reason: `Known malware signature detected: ${malwareName}`,
                        logs: [log]
                    });
                }
            }
        }
        
        return threats;
    }

    matchesSignature(log, signature) {
        // Check port match
        if (signature.ports && !signature.ports.includes(log.destPort)) {
            return false;
        }
        
        // Check payload pattern
        if (signature.payloadPattern && log.payload) {
            if (!signature.payloadPattern.test(log.payload)) {
                return false;
            }
        }
        
        // Check user agent
        if (signature.userAgents && log.userAgent) {
            if (!signature.userAgents.some(agent => log.userAgent.includes(agent))) {
                return false;
            }
        }
        
        // Check HTTP method
        if (signature.httpMethods && log.httpMethod) {
            if (!signature.httpMethods.includes(log.httpMethod)) {
                return false;
            }
        }
        
        return true;
    }

    async detectThreatsWithAI(sourceIP, logs) {
        try {
            // Extract features from the logs
            const features = this.extractThreatFeatures(sourceIP, logs);
            
            // Make AI prediction
            const input = tf.tensor2d([features]);
            const prediction = this.model.predict(input);
            const probabilities = await prediction.data();
            
            input.dispose();
            prediction.dispose();
            
            const threatTypes = Object.keys(this.threatCategories);
            const allCategories = [...threatTypes, 'benign'];
            
            // Find the highest probability threat
            const maxIndex = probabilities.indexOf(Math.max(...probabilities));
            const confidence = probabilities[maxIndex];
            const predictedCategory = allCategories[maxIndex];
            
            // Only report if confidence is above threshold and it's not benign
            if (confidence >= this.config.threatThreshold && predictedCategory !== 'benign') {
                return [{
                    sourceIP,
                    threatType: predictedCategory,
                    severity: confidence >= this.config.criticalThreshold ? 'critical' : 'high',
                    confidence,
                    reason: `AI model prediction with ${(confidence * 100).toFixed(1)}% confidence`,
                    features,
                    logs: logs.slice(0, 5),
                    alternatives: this.getAlternativeThreatTypes(probabilities, allCategories)
                }];
            }
            
            return [];
            
        } catch (error) {
            this.logger.error('AI threat detection failed:', error);
            return [];
        }
    }

    extractThreatFeatures(sourceIP, logs) {
        // Calculate various network behavior features
        const connectionRate = logs.length;
        const uniquePorts = new Set(logs.map(log => log.destPort));
        const portVariance = uniquePorts.size / Math.max(logs.length, 1);
        const totalBytes = logs.reduce((sum, log) => sum + log.bytes, 0);
        const failedConnections = logs.filter(log => log.flags && log.flags.includes('RST'));
        const failureRate = failedConnections.length / Math.max(logs.length, 1);
        
        // Calculate repetition (same destination patterns)
        const destPatterns = new Map();
        logs.forEach(log => {
            const pattern = `${log.destIP}:${log.destPort}`;
            destPatterns.set(pattern, (destPatterns.get(pattern) || 0) + 1);
        });
        const maxRepetition = Math.max(...destPatterns.values()) / logs.length;
        
        // Payload analysis
        const payloadEntropy = this.calculatePayloadEntropy(logs);
        const suspiciousPatterns = this.calculateSuspiciousPatternScore(logs);
        const privilegeEscalation = this.calculatePrivilegeEscalationScore(logs);
        const coordinationScore = this.calculateCoordinationScore(sourceIP);
        
        // Time-based features
        const currentHour = new Date().getHours();
        const currentDay = new Date().getDay();
        
        // Geographic and reputation features
        const geoConsistency = this.calculateGeographicConsistency(sourceIP);
        const protocolCompliance = this.calculateProtocolCompliance(logs);
        const anomalyScore = this.calculateAnomalyScore(logs);
        const reputationScore = this.getIPReputation(sourceIP);
        
        // Session characteristics
        const avgSessionDuration = logs.reduce((sum, log) => sum + log.duration, 0) / logs.length;
        const totalPackets = logs.reduce((sum, log) => sum + log.packets, 0);
        const errorRate = logs.filter(log => log.flags && 
            (log.flags.includes('RST') || log.flags.includes('FIN'))).length / logs.length;
        
        return [
            connectionRate,
            portVariance,
            totalBytes / 1000000, // Normalize to MB
            failureRate,
            maxRepetition,
            payloadEntropy,
            suspiciousPatterns,
            privilegeEscalation,
            coordinationScore,
            currentHour / 24,
            currentDay / 7,
            geoConsistency,
            protocolCompliance,
            anomalyScore,
            reputationScore,
            avgSessionDuration / 3600, // Normalize to hours
            totalPackets / 1000, // Normalize
            errorRate
        ];
    }

    calculatePayloadEntropy(logs) {
        // Simplified entropy calculation
        const payloads = logs.map(log => log.payload).filter(Boolean);
        if (payloads.length === 0) return 0.5;
        
        const combined = payloads.join('');
        const charFreq = {};
        
        for (const char of combined) {
            charFreq[char] = (charFreq[char] || 0) + 1;
        }
        
        let entropy = 0;
        const length = combined.length;
        
        for (const freq of Object.values(charFreq)) {
            const probability = freq / length;
            entropy -= probability * Math.log2(probability);
        }
        
        return Math.min(entropy / 8, 1); // Normalize to 0-1
    }

    calculateSuspiciousPatternScore(logs) {
        let score = 0;
        
        logs.forEach(log => {
            if (log.payload) {
                // Check for SQL injection patterns
                if (/union|select|insert|update|delete|drop/i.test(log.payload)) {
                    score += 0.3;
                }
                
                // Check for XSS patterns
                if (/<script|javascript:|onload=|onerror=/i.test(log.payload)) {
                    score += 0.2;
                }
                
                // Check for command injection
                if (/;|\||&|`|\$\(|\$\{/i.test(log.payload)) {
                    score += 0.2;
                }
            }
            
            // Check user agent
            if (log.userAgent && /bot|crawler|scanner|exploit/i.test(log.userAgent)) {
                score += 0.1;
            }
        });
        
        return Math.min(score, 1);
    }

    calculatePrivilegeEscalationScore(logs) {
        let score = 0;
        
        logs.forEach(log => {
            // Check for admin/privileged ports
            if ([22, 23, 3389, 5432, 3306].includes(log.destPort)) {
                score += 0.2;
            }
            
            // Check for privileged paths in HTTP requests
            if (log.payload && /admin|root|config|passwd|shadow/i.test(log.payload)) {
                score += 0.3;
            }
        });
        
        return Math.min(score, 1);
    }

    calculateCoordinationScore(sourceIP) {
        // Check if this IP is part of coordinated activity
        const recentThreats = this.threatHistory.filter(threat => 
            Date.now() - threat.timestamp < 3600000 // Last hour
        );
        
        const sameSubnetThreats = recentThreats.filter(threat => {
            const sourceSubnet = sourceIP.split('.').slice(0, 3).join('.');
            const threatSubnet = threat.sourceIP.split('.').slice(0, 3).join('.');
            return sourceSubnet === threatSubnet;
        });
        
        return Math.min(sameSubnetThreats.length / 10, 1);
    }

    calculateGeographicConsistency(sourceIP) {
        // Simplified geographic consistency check
        // In practice, this would use GeoIP databases
        const isPrivateIP = /^(10\.|172\.|192\.168\.)/.test(sourceIP);
        return isPrivateIP ? 0.8 : 0.5; // Private IPs are more consistent
    }

    calculateProtocolCompliance(logs) {
        let compliantConnections = 0;
        
        logs.forEach(log => {
            // Check if TCP flags make sense
            if (log.protocol === 'TCP' && log.flags) {
                const hasValidFlags = log.flags.some(flag => 
                    ['SYN', 'ACK', 'FIN', 'RST'].includes(flag)
                );
                if (hasValidFlags) compliantConnections++;
            } else if (log.protocol === 'UDP') {
                compliantConnections++; // UDP doesn't have flags
            }
        });
        
        return compliantConnections / Math.max(logs.length, 1);
    }

    calculateAnomalyScore(logs) {
        let anomalies = 0;
        
        logs.forEach(log => {
            // Unusual port combinations
            if (log.sourcePort > 0 && log.sourcePort < 1024 && log.destPort > 1024) {
                anomalies += 0.1;
            }
            
            // Unusual packet sizes
            if (log.bytes < 20 || log.bytes > 65535) {
                anomalies += 0.1;
            }
            
            // Protocol mismatches
            if (log.protocol === 'UDP' && [80, 443, 22, 23].includes(log.destPort)) {
                anomalies += 0.2;
            }
        });
        
        return Math.min(anomalies, 1);
    }

    getIPReputation(sourceIP) {
        // Check if IP has reputation data
        if (this.ipBlacklist.has(sourceIP)) return 0;
        if (this.ipWhitelist.has(sourceIP)) return 1;
        
        const suspiciousData = this.suspiciousIPs.get(sourceIP);
        if (suspiciousData) {
            return Math.max(0, 1 - (suspiciousData.score / 10));
        }
        
        return 0.5; // Neutral reputation
    }

    getAlternativeThreatTypes(probabilities, categories) {
        return categories
            .map((category, index) => ({ category, probability: probabilities[index] }))
            .filter(item => item.category !== 'benign')
            .sort((a, b) => b.probability - a.probability)
            .slice(1, 4); // Top 3 alternatives
    }

    async processThreat(threat) {
        const startTime = Date.now();
        
        try {
            // Log the threat
            this.logger.warn(`Threat detected: ${threat.threatType} from ${threat.sourceIP}`, {
                severity: threat.severity,
                confidence: threat.confidence,
                reason: threat.reason
            });
            
            // Add to threat history
            this.threatHistory.push({
                ...threat,
                timestamp: Date.now()
            });
            
            // Update metrics
            this.metrics.threatsDetected++;
            
            // Determine response action
            const response = await this.determineResponse(threat);
            
            // Execute response
            await this.executeResponse(threat, response);
            
            // Update suspicious IPs tracking
            this.updateSuspiciousIPs(threat);
            
            // Emit threat event
            this.emit('threatProcessed', {
                threat,
                response,
                processingTime: Date.now() - startTime
            });
            
            return response;
            
        } catch (error) {
            this.logger.error(`Failed to process threat from ${threat.sourceIP}:`, error);
            return { action: 'log_only', success: false, error: error.message };
        }
    }

    async determineResponse(threat) {
        const response = {
            action: 'monitor',
            reason: '',
            automated: true
        };
        
        // Critical threats get immediate blocking
        if (threat.severity === 'critical' || threat.confidence >= this.config.criticalThreshold) {
            response.action = 'block';
            response.reason = 'Critical threat detected';
        }
        // High severity threats get rate limiting
        else if (threat.severity === 'high' || threat.confidence >= this.config.threatThreshold) {
            response.action = 'rate_limit';
            response.reason = 'High severity threat detected';
        }
        // Medium threats get enhanced monitoring
        else if (threat.severity === 'medium') {
            response.action = 'monitor';
            response.reason = 'Medium severity threat - enhanced monitoring';
        }
        
        // Special handling for specific threat types
        switch (threat.threatType) {
            case 'ddos':
                response.action = 'rate_limit';
                response.limits = { connections: 10, timeWindow: 60 };
                break;
                
            case 'malware':
                response.action = 'block';
                response.quarantine = true;
                break;
                
            case 'brute_force':
                response.action = 'temporary_block';
                response.duration = 3600; // 1 hour
                break;
        }
        
        return response;
    }

    async executeResponse(threat, response) {
        const sourceIP = threat.sourceIP;
        
        switch (response.action) {
            case 'block':
                await this.blockIP(sourceIP, response);
                this.logger.info(`Blocked IP ${sourceIP} due to ${threat.threatType}`);
                break;
                
            case 'temporary_block':
                await this.temporaryBlockIP(sourceIP, response.duration);
                this.logger.info(`Temporarily blocked IP ${sourceIP} for ${response.duration} seconds`);
                break;
                
            case 'rate_limit':
                await this.rateLimitIP(sourceIP, response.limits);
                this.logger.info(`Applied rate limiting to IP ${sourceIP}`);
                break;
                
            case 'monitor':
                await this.enhanceMonitoring(sourceIP);
                this.logger.info(`Enhanced monitoring for IP ${sourceIP}`);
                break;
                
            default:
                this.logger.info(`No action taken for IP ${sourceIP}`);
        }
        
        response.success = true;
        this.metrics.blockedAttacks++;
    }

    async blockIP(sourceIP, response) {
        // Add to blacklist
        this.ipBlacklist.add(sourceIP);
        
        // Simulate firewall rule addition
        this.logger.debug(`Added firewall rule to block ${sourceIP}`);
        
        if (response.quarantine) {
            // Additional quarantine measures
            this.logger.debug(`Quarantined IP ${sourceIP} for malware`);
        }
    }

    async temporaryBlockIP(sourceIP, duration) {
        // Simulate temporary firewall rule
        this.logger.debug(`Added temporary firewall rule for ${sourceIP}`);
        
        // Schedule removal
        setTimeout(() => {
            this.logger.debug(`Removed temporary block for ${sourceIP}`);
        }, duration * 1000);
    }

    async rateLimitIP(sourceIP, limits) {
        // Simulate rate limiting implementation
        const { connections = 10, timeWindow = 60 } = limits || {};
        this.logger.debug(`Applied rate limit: ${connections} connections per ${timeWindow}s for ${sourceIP}`);
    }

    async enhanceMonitoring(sourceIP) {
        // Add to suspicious IPs with enhanced monitoring
        const suspiciousData = this.suspiciousIPs.get(sourceIP) || { score: 0, firstSeen: Date.now() };
        suspiciousData.score += 1;
        suspiciousData.lastSeen = Date.now();
        this.suspiciousIPs.set(sourceIP, suspiciousData);
    }

    updateSuspiciousIPs(threat) {
        const sourceIP = threat.sourceIP;
        const suspiciousData = this.suspiciousIPs.get(sourceIP) || { 
            score: 0, 
            firstSeen: Date.now(),
            threats: []
        };
        
        suspiciousData.score += threat.confidence;
        suspiciousData.lastSeen = Date.now();
        suspiciousData.threats.push({
            type: threat.threatType,
            timestamp: Date.now(),
            confidence: threat.confidence
        });
        
        // Keep only recent threats
        suspiciousData.threats = suspiciousData.threats.filter(t => 
            Date.now() - t.timestamp < 86400000 // 24 hours
        );
        
        this.suspiciousIPs.set(sourceIP, suspiciousData);
        
        // Auto-blacklist if score is too high
        if (suspiciousData.score > 5) {
            this.ipBlacklist.add(sourceIP);
            this.logger.warn(`Auto-blacklisted IP ${sourceIP} due to high suspicious score: ${suspiciousData.score}`);
        }
    }

    updateScanMetrics(scanTime, threatsFound) {
        const totalScans = this.metrics.totalScans;
        
        // Update average response time
        this.metrics.averageResponseTime = 
            (this.metrics.averageResponseTime * (totalScans - 1) + scanTime) / totalScans;
    }

    getCurrentStatus() {
        return {
            initialized: this.isInitialized,
            scanning: this.isScanning,
            activeConnections: this.activeConnections.size,
            networkLogs: this.networkLogs.length,
            threatHistory: this.threatHistory.length,
            suspiciousIPs: this.suspiciousIPs.size,
            blacklistedIPs: this.ipBlacklist.size,
            whitelistedIPs: this.ipWhitelist.size,
            knownSignatures: this.knownThreatSignatures.size,
            metrics: this.metrics,
            modelLoaded: this.model !== null,
            lastScan: this.metrics.totalScans > 0 ? Date.now() : null
        };
    }

    getStatus() {
        return this.getCurrentStatus();
    }

    async shutdown() {
        this.logger.info('Shutting down Threat Detection System...');
        
        this.isScanning = false;
        
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
        }
        
        if (this.model) {
            this.model.dispose();
        }
        
        this.removeAllListeners();
        this.isInitialized = false;
    }
}

module.exports = ThreatDetector;