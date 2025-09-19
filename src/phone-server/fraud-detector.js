const tf = require('@tensorflow/tfjs');
const EventEmitter = require('events');
const Logger = require('../shared/logger');

/**
 * AI-Powered Fraud Detection System
 * Uses machine learning to detect suspicious call patterns and potential fraud
 */
class FraudDetector extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            modelPath: config.modelPath || './models/fraud-detection-model.json',
            riskThreshold: config.riskThreshold || 0.7,
            blacklistPath: config.blacklistPath || './data/blacklist.json',
            whitelistPath: config.whitelistPath || './data/whitelist.json',
            maxCallDuration: config.maxCallDuration || 3600, // 1 hour
            maxCallsPerHour: config.maxCallsPerHour || 50,
            ...config
        };
        
        this.logger = new Logger('FraudDetector');
        this.model = null;
        this.isInitialized = false;
        this.callHistory = new Map(); // Phone number -> call data
        this.blacklist = new Set();
        this.whitelist = new Set();
        this.fraudPatterns = [];
        this.metrics = {
            totalCalls: 0,
            fraudDetected: 0,
            falsePositives: 0,
            trueFraudPrevented: 0
        };
        
        // Fraud indicators and their weights
        this.fraudIndicators = {
            'rapid_successive_calls': 0.8,
            'unusual_call_duration': 0.6,
            'geographical_anomaly': 0.7,
            'voice_pattern_mismatch': 0.9,
            'blacklisted_number': 1.0,
            'suspicious_keywords': 0.5,
            'call_time_anomaly': 0.4,
            'multiple_identity_claims': 0.8
        };
    }

    async initialize() {
        try {
            this.logger.info('Initializing Fraud Detector...');
            
            // Load fraud detection model
            await this.loadFraudModel();
            
            // Load blacklist and whitelist
            await this.loadLists();
            
            // Start real-time monitoring
            this.startMonitoring();
            
            this.isInitialized = true;
            this.logger.info('Fraud Detector initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Fraud Detector:', error);
            throw error;
        }
    }

    async loadFraudModel() {
        try {
            // Try to load existing model
            this.model = await tf.loadLayersModel(`file://${this.config.modelPath}`);
            this.logger.info('Loaded existing fraud detection model');
        } catch (error) {
            // Create new model if none exists
            this.logger.info('Creating new fraud detection model...');
            this.model = this.createFraudModel();
            await this.trainFraudModel();
        }
    }

    createFraudModel() {
        // Neural network for fraud detection
        const model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [15], // Fraud features
                    units: 64,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({
                    units: 32,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 16,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: 1,
                    activation: 'sigmoid' // Binary classification (fraud/legitimate)
                })
            ]
        });

        model.compile({
            optimizer: 'adam',
            loss: 'binaryCrossentropy',
            metrics: ['accuracy', 'precision', 'recall']
        });

        return model;
    }

    async trainFraudModel() {
        // Generate training data with known fraud patterns
        const trainingData = this.generateFraudTrainingData(5000);
        
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
        
        this.logger.info('Fraud detection model training completed');
    }

    generateFraudTrainingData(numSamples) {
        const features = [];
        const labels = [];

        for (let i = 0; i < numSamples; i++) {
            const isFraud = Math.random() < 0.15; // 15% fraud rate for training
            
            let feature;
            if (isFraud) {
                // Generate fraudulent call features
                feature = this.generateFraudulentFeatures();
            } else {
                // Generate legitimate call features
                feature = this.generateLegitimateFeatures();
            }
            
            features.push(feature);
            labels.push([isFraud ? 1 : 0]);
        }

        return { features, labels };
    }

    generateFraudulentFeatures() {
        return [
            Math.random() * 20 + 5,    // calls_per_hour (high)
            Math.random() * 10 + 1,    // call_duration_variance (high)
            Math.random() * 0.3,       // geographic_consistency (low)
            Math.random() * 0.4,       // voice_consistency (low)
            Math.random() > 0.8 ? 1 : 0, // blacklisted_number
            Math.random() * 0.8 + 0.2, // suspicious_keywords_score
            Math.random() * 0.5,       // time_pattern_consistency (low)
            Math.random() * 0.9 + 0.1, // identity_claims_variance (high)
            Math.random() * 0.4,       // caller_history_score (low)
            Math.random() * 1000 + 2000, // call_duration (very long/short)
            Math.random() * 0.3,       // network_quality (poor for VOIP fraud)
            Math.random() * 0.9 + 0.1, // urgency_pressure_score (high)
            Math.random() * 0.8 + 0.2, // personal_info_requests (high)
            Math.random() * 5 + 1,     // callback_refusal_count (high)
            Math.random() * 0.2        // agent_familiarity (low)
        ];
    }

    generateLegitimateFeatures() {
        return [
            Math.random() * 5 + 1,     // calls_per_hour (normal)
            Math.random() * 3 + 1,     // call_duration_variance (normal)
            Math.random() * 0.5 + 0.5, // geographic_consistency (high)
            Math.random() * 0.3 + 0.7, // voice_consistency (high)
            0,                         // blacklisted_number (false)
            Math.random() * 0.3,       // suspicious_keywords_score (low)
            Math.random() * 0.4 + 0.6, // time_pattern_consistency (high)
            Math.random() * 0.3,       // identity_claims_variance (low)
            Math.random() * 0.5 + 0.5, // caller_history_score (good)
            Math.random() * 600 + 60,  // call_duration (normal)
            Math.random() * 0.4 + 0.6, // network_quality (good)
            Math.random() * 0.4,       // urgency_pressure_score (low)
            Math.random() * 0.3,       // personal_info_requests (low)
            Math.random() * 2,         // callback_refusal_count (low)
            Math.random() * 0.5 + 0.5  // agent_familiarity (high)
        ];
    }

    async loadLists() {
        try {
            // Load blacklist
            const fs = require('fs').promises;
            try {
                const blacklistData = await fs.readFile(this.config.blacklistPath, 'utf8');
                const blacklistNumbers = JSON.parse(blacklistData);
                this.blacklist = new Set(blacklistNumbers);
                this.logger.info(`Loaded ${this.blacklist.size} numbers to blacklist`);
            } catch (error) {
                this.logger.warn('No blacklist file found, starting with empty blacklist');
                this.blacklist = new Set();
            }

            // Load whitelist
            try {
                const whitelistData = await fs.readFile(this.config.whitelistPath, 'utf8');
                const whitelistNumbers = JSON.parse(whitelistData);
                this.whitelist = new Set(whitelistNumbers);
                this.logger.info(`Loaded ${this.whitelist.size} numbers to whitelist`);
            } catch (error) {
                this.logger.warn('No whitelist file found, starting with empty whitelist');
                this.whitelist = new Set();
            }
        } catch (error) {
            this.logger.error('Failed to load blacklist/whitelist:', error);
        }
    }

    startMonitoring() {
        // Clean up old call history every hour
        setInterval(() => {
            this.cleanupOldHistory();
        }, 3600000); // 1 hour

        // Update fraud patterns every 6 hours
        setInterval(() => {
            this.updateFraudPatterns();
        }, 21600000); // 6 hours

        this.logger.info('Real-time fraud monitoring started');
    }

    async detectFraud(callData) {
        if (!this.isInitialized) {
            throw new Error('Fraud Detector not initialized');
        }

        const analysisId = this.generateAnalysisId();
        const startTime = Date.now();

        try {
            // Quick whitelist check
            if (this.whitelist.has(callData.callerPhone)) {
                return {
                    analysisId,
                    riskScore: 0.0,
                    riskLevel: 'very_low',
                    isFraud: false,
                    reason: 'whitelisted_number',
                    processingTime: Date.now() - startTime
                };
            }

            // Quick blacklist check
            if (this.blacklist.has(callData.callerPhone)) {
                this.logFraudDetection(callData, 'blacklisted_number', 1.0);
                return {
                    analysisId,
                    riskScore: 1.0,
                    riskLevel: 'critical',
                    isFraud: true,
                    reason: 'blacklisted_number',
                    action: 'block_immediately',
                    processingTime: Date.now() - startTime
                };
            }

            // Extract fraud features
            const features = await this.extractFraudFeatures(callData);
            
            // Rule-based initial screening
            const ruleBasedResult = this.applyRuleBasedDetection(features, callData);
            
            // AI model prediction
            const mlResult = await this.predictFraud(features);
            
            // Combine results
            const finalResult = this.combineResults(ruleBasedResult, mlResult, callData);
            
            // Update call history
            this.updateCallHistory(callData, finalResult);
            
            // Log if fraud detected
            if (finalResult.isFraud) {
                this.logFraudDetection(callData, finalResult.reason, finalResult.riskScore);
                this.emit('fraudDetected', {
                    callData,
                    result: finalResult,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Update metrics
            this.updateMetrics(finalResult.isFraud);
            
            return {
                ...finalResult,
                analysisId,
                processingTime: Date.now() - startTime
            };
            
        } catch (error) {
            this.logger.error(`Fraud detection failed for ${analysisId}:`, error);
            
            // Return safe default
            return {
                analysisId,
                riskScore: 0.5,
                riskLevel: 'medium',
                isFraud: false,
                reason: 'analysis_error',
                error: error.message,
                processingTime: Date.now() - startTime
            };
        }
    }

    async extractFraudFeatures(callData) {
        const phone = callData.callerPhone;
        const history = this.callHistory.get(phone) || { calls: [], firstSeen: Date.now() };
        const currentTime = Date.now();
        
        // Calculate time-based features
        const recentCalls = history.calls.filter(call => 
            currentTime - call.timestamp < 3600000 // Last hour
        );
        
        const callsPerHour = recentCalls.length;
        
        // Calculate duration variance
        const durations = recentCalls.map(call => call.duration || 0);
        const avgDuration = durations.reduce((sum, d) => sum + d, 0) / (durations.length || 1);
        const durationVariance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / (durations.length || 1);
        
        // Geographic consistency
        const locations = recentCalls.map(call => call.location).filter(Boolean);
        const uniqueLocations = new Set(locations);
        const geographicConsistency = locations.length > 0 ? 
            1 - (uniqueLocations.size - 1) / Math.max(locations.length - 1, 1) : 1;
        
        // Voice consistency (if available)
        const voiceConsistency = callData.voiceSignature ? 
            this.calculateVoiceConsistency(callData.voiceSignature, history) : 0.8;
        
        // Blacklist check
        const blacklistedNumber = this.blacklist.has(phone) ? 1 : 0;
        
        // Suspicious keywords score
        const suspiciousKeywordsScore = this.calculateSuspiciousKeywords(callData.transcript || '');
        
        // Time pattern consistency
        const timePatternConsistency = this.calculateTimePatternConsistency(recentCalls);
        
        // Identity claims variance
        const identityClaimsVariance = this.calculateIdentityVariance(callData, history);
        
        // Caller history score
        const callerHistoryScore = this.calculateCallerHistoryScore(history);
        
        // Current call duration
        const callDuration = callData.duration || 0;
        
        // Network quality (for VOIP fraud detection)
        const networkQuality = callData.networkQuality || 0.8;
        
        // Urgency pressure score
        const urgencyPressureScore = this.calculateUrgencyPressure(callData.transcript || '');
        
        // Personal info requests
        const personalInfoRequests = this.calculatePersonalInfoRequests(callData.transcript || '');
        
        // Callback refusal count
        const callbackRefusalCount = history.callbackRefusals || 0;
        
        // Agent familiarity
        const agentFamiliarity = this.calculateAgentFamiliarity(callData, history);
        
        return [
            callsPerHour,
            Math.sqrt(durationVariance),
            geographicConsistency,
            voiceConsistency,
            blacklistedNumber,
            suspiciousKeywordsScore,
            timePatternConsistency,
            identityClaimsVariance,
            callerHistoryScore,
            callDuration,
            networkQuality,
            urgencyPressureScore,
            personalInfoRequests,
            callbackRefusalCount,
            agentFamiliarity
        ];
    }

    calculateVoiceConsistency(currentSignature, history) {
        if (!history.voiceSignatures || history.voiceSignatures.length === 0) {
            return 0.8; // Default for new callers
        }
        
        // Calculate similarity with previous voice signatures
        const similarities = history.voiceSignatures.map(signature => 
            this.calculateVoiceSimilarity(currentSignature, signature)
        );
        
        return similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
    }

    calculateVoiceSimilarity(sig1, sig2) {
        // Simplified voice similarity calculation
        // In practice, this would use spectral features, MFCCs, etc.
        const features1 = sig1.features || [];
        const features2 = sig2.features || [];
        
        if (features1.length === 0 || features2.length === 0) return 0.5;
        
        let similarity = 0;
        const minLength = Math.min(features1.length, features2.length);
        
        for (let i = 0; i < minLength; i++) {
            similarity += 1 - Math.abs(features1[i] - features2[i]);
        }
        
        return similarity / minLength;
    }

    calculateSuspiciousKeywords(transcript) {
        const suspiciousKeywords = [
            'urgent', 'immediate', 'emergency', 'verify', 'confirm', 'security',
            'account locked', 'suspended', 'update payment', 'refund',
            'social security', 'ssn', 'credit card', 'bank account',
            'wire transfer', 'bitcoin', 'gift card', 'warranty',
            'you have won', 'congratulations', 'free trial'
        ];
        
        const lowerTranscript = transcript.toLowerCase();
        let score = 0;
        
        suspiciousKeywords.forEach(keyword => {
            if (lowerTranscript.includes(keyword)) {
                score += 0.1;
            }
        });
        
        return Math.min(score, 1.0);
    }

    calculateTimePatternConsistency(recentCalls) {
        if (recentCalls.length < 2) return 1.0;
        
        const hours = recentCalls.map(call => new Date(call.timestamp).getHours());
        const hourCounts = {};
        
        hours.forEach(hour => {
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });
        
        const uniqueHours = Object.keys(hourCounts).length;
        return 1 - (uniqueHours - 1) / 23; // Normalized by max possible variance
    }

    calculateIdentityVariance(callData, history) {
        if (!history.identityClaims) return 0;
        
        const currentClaims = {
            name: callData.callerName,
            address: callData.callerAddress,
            dateOfBirth: callData.dateOfBirth
        };
        
        let variance = 0;
        let claimCount = 0;
        
        Object.keys(currentClaims).forEach(key => {
            if (currentClaims[key] && history.identityClaims[key]) {
                claimCount++;
                if (currentClaims[key] !== history.identityClaims[key]) {
                    variance += 1;
                }
            }
        });
        
        return claimCount > 0 ? variance / claimCount : 0;
    }

    calculateCallerHistoryScore(history) {
        if (history.calls.length === 0) return 0.5; // Neutral for new callers
        
        let score = 0.5;
        
        // Positive indicators
        if (history.successfulVerifications > 0) score += 0.2;
        if (history.satisfactionRatings && history.satisfactionRatings.length > 0) {
            const avgSatisfaction = history.satisfactionRatings.reduce((sum, r) => sum + r, 0) / history.satisfactionRatings.length;
            score += (avgSatisfaction - 0.5) * 0.4;
        }
        
        // Negative indicators
        if (history.failedVerifications > 2) score -= 0.3;
        if (history.complaints > 0) score -= 0.2;
        if (history.escalations > 1) score -= 0.1;
        
        return Math.max(0, Math.min(1, score));
    }

    calculateUrgencyPressure(transcript) {
        const urgencyWords = [
            'urgent', 'emergency', 'immediate', 'asap', 'right now',
            'can\'t wait', 'deadline', 'time sensitive', 'critical'
        ];
        
        const lowerTranscript = transcript.toLowerCase();
        let score = 0;
        
        urgencyWords.forEach(word => {
            if (lowerTranscript.includes(word)) {
                score += 0.15;
            }
        });
        
        return Math.min(score, 1.0);
    }

    calculatePersonalInfoRequests(transcript) {
        const personalInfoKeywords = [
            'social security', 'ssn', 'credit card', 'bank account',
            'password', 'pin', 'date of birth', 'mother\'s maiden name',
            'security question', 'verify account', 'confirm identity'
        ];
        
        const lowerTranscript = transcript.toLowerCase();
        let score = 0;
        
        personalInfoKeywords.forEach(keyword => {
            if (lowerTranscript.includes(keyword)) {
                score += 0.2;
            }
        });
        
        return Math.min(score, 1.0);
    }

    calculateAgentFamiliarity(callData, history) {
        if (!history.agents) return 0;
        
        const currentAgent = callData.agentId;
        const agentCounts = {};
        
        history.calls.forEach(call => {
            if (call.agentId) {
                agentCounts[call.agentId] = (agentCounts[call.agentId] || 0) + 1;
            }
        });
        
        const totalCalls = history.calls.length;
        const currentAgentCalls = agentCounts[currentAgent] || 0;
        
        return totalCalls > 0 ? currentAgentCalls / totalCalls : 0;
    }

    applyRuleBasedDetection(features, callData) {
        const rules = [];
        
        // Rule 1: Too many calls in short time
        if (features[0] > this.config.maxCallsPerHour) {
            rules.push({
                rule: 'excessive_call_frequency',
                score: 0.9,
                description: `${features[0]} calls in the last hour (max: ${this.config.maxCallsPerHour})`
            });
        }
        
        // Rule 2: Extremely long call duration
        if (features[9] > this.config.maxCallDuration) {
            rules.push({
                rule: 'excessive_call_duration',
                score: 0.8,
                description: `Call duration ${features[9]}s (max: ${this.config.maxCallDuration}s)`
            });
        }
        
        // Rule 3: High personal info requests
        if (features[12] > 0.6) {
            rules.push({
                rule: 'excessive_personal_info_requests',
                score: 0.7,
                description: 'High number of personal information requests detected'
            });
        }
        
        // Rule 4: Geographic inconsistency
        if (features[2] < 0.3) {
            rules.push({
                rule: 'geographic_inconsistency',
                score: 0.6,
                description: 'Calls from multiple inconsistent locations'
            });
        }
        
        // Calculate overall rule-based score
        const maxRuleScore = rules.length > 0 ? Math.max(...rules.map(r => r.score)) : 0;
        
        return {
            score: maxRuleScore,
            triggeredRules: rules,
            riskLevel: this.calculateRiskLevel(maxRuleScore)
        };
    }

    async predictFraud(features) {
        const input = tf.tensor2d([features]);
        const prediction = this.model.predict(input);
        const fraudProbability = (await prediction.data())[0];
        
        input.dispose();
        prediction.dispose();
        
        return {
            probability: fraudProbability,
            confidence: Math.abs(fraudProbability - 0.5) * 2, // Distance from uncertainty
            riskLevel: this.calculateRiskLevel(fraudProbability)
        };
    }

    combineResults(ruleBasedResult, mlResult, callData) {
        // Weighted combination of rule-based and ML results
        const ruleWeight = 0.4;
        const mlWeight = 0.6;
        
        const combinedScore = (ruleBasedResult.score * ruleWeight) + (mlResult.probability * mlWeight);
        const finalRiskLevel = this.calculateRiskLevel(combinedScore);
        const isFraud = combinedScore >= this.config.riskThreshold;
        
        // Determine primary reason
        let reason = 'ml_prediction';
        if (ruleBasedResult.triggeredRules.length > 0) {
            reason = ruleBasedResult.triggeredRules[0].rule;
        }
        
        // Determine recommended action
        const action = this.determineAction(combinedScore, ruleBasedResult.triggeredRules);
        
        return {
            riskScore: combinedScore,
            riskLevel: finalRiskLevel,
            isFraud,
            reason,
            action,
            details: {
                ruleBasedScore: ruleBasedResult.score,
                mlScore: mlResult.probability,
                mlConfidence: mlResult.confidence,
                triggeredRules: ruleBasedResult.triggeredRules
            },
            recommendations: this.generateRecommendations(combinedScore, ruleBasedResult.triggeredRules)
        };
    }

    calculateRiskLevel(score) {
        if (score >= 0.9) return 'critical';
        if (score >= 0.7) return 'high';
        if (score >= 0.5) return 'medium';
        if (score >= 0.3) return 'low';
        return 'very_low';
    }

    determineAction(score, triggeredRules) {
        if (score >= 0.9) return 'block_immediately';
        if (score >= 0.7) return 'require_additional_verification';
        if (score >= 0.5) return 'flag_for_review';
        if (score >= 0.3) return 'monitor_closely';
        return 'allow_normal_processing';
    }

    generateRecommendations(score, triggeredRules) {
        const recommendations = [];
        
        if (score >= 0.7) {
            recommendations.push('Escalate to fraud specialist immediately');
            recommendations.push('Do not process any sensitive requests');
        }
        
        if (score >= 0.5) {
            recommendations.push('Require additional identity verification');
            recommendations.push('Log all interaction details');
        }
        
        triggeredRules.forEach(rule => {
            switch (rule.rule) {
                case 'excessive_call_frequency':
                    recommendations.push('Implement temporary rate limiting for this number');
                    break;
                case 'excessive_personal_info_requests':
                    recommendations.push('Refuse to provide personal information');
                    break;
                case 'geographic_inconsistency':
                    recommendations.push('Verify caller location through alternative means');
                    break;
            }
        });
        
        return recommendations;
    }

    updateCallHistory(callData, result) {
        const phone = callData.callerPhone;
        const history = this.callHistory.get(phone) || {
            calls: [],
            firstSeen: Date.now(),
            successfulVerifications: 0,
            failedVerifications: 0,
            complaints: 0,
            escalations: 0,
            satisfactionRatings: [],
            callbackRefusals: 0,
            identityClaims: {},
            voiceSignatures: []
        };
        
        // Add current call
        history.calls.push({
            timestamp: Date.now(),
            duration: callData.duration,
            location: callData.location,
            agentId: callData.agentId,
            riskScore: result.riskScore,
            outcome: callData.outcome
        });
        
        // Update identity claims
        if (callData.callerName) history.identityClaims.name = callData.callerName;
        if (callData.callerAddress) history.identityClaims.address = callData.callerAddress;
        if (callData.dateOfBirth) history.identityClaims.dateOfBirth = callData.dateOfBirth;
        
        // Update voice signature
        if (callData.voiceSignature) {
            history.voiceSignatures.push(callData.voiceSignature);
            // Keep only last 5 signatures
            if (history.voiceSignatures.length > 5) {
                history.voiceSignatures = history.voiceSignatures.slice(-5);
            }
        }
        
        // Update verification counts
        if (callData.verificationResult === 'success') {
            history.successfulVerifications++;
        } else if (callData.verificationResult === 'failed') {
            history.failedVerifications++;
        }
        
        this.callHistory.set(phone, history);
    }

    logFraudDetection(callData, reason, riskScore) {
        this.logger.warn('Fraud detected:', {
            callerPhone: callData.callerPhone,
            reason,
            riskScore: riskScore.toFixed(3),
            timestamp: new Date().toISOString(),
            callId: callData.callId
        });
        
        // Add to fraud patterns for learning
        this.fraudPatterns.push({
            phone: callData.callerPhone,
            reason,
            riskScore,
            timestamp: Date.now(),
            features: callData.features
        });
        
        // Auto-add to blacklist if score is very high
        if (riskScore >= 0.95) {
            this.blacklist.add(callData.callerPhone);
            this.logger.info(`Added ${callData.callerPhone} to blacklist due to high fraud score`);
        }
    }

    cleanupOldHistory() {
        const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
        
        for (const [phone, history] of this.callHistory.entries()) {
            // Remove old calls
            history.calls = history.calls.filter(call => call.timestamp > cutoffTime);
            
            // Remove history if no recent calls
            if (history.calls.length === 0 && history.firstSeen < cutoffTime) {
                this.callHistory.delete(phone);
            }
        }
        
        // Clean fraud patterns
        this.fraudPatterns = this.fraudPatterns.filter(pattern => 
            Date.now() - pattern.timestamp < cutoffTime
        );
        
        this.logger.info(`Cleaned up old call history. Active entries: ${this.callHistory.size}`);
    }

    updateFraudPatterns() {
        // Analyze recent fraud patterns and update detection rules
        const recentFraud = this.fraudPatterns.filter(pattern => 
            Date.now() - pattern.timestamp < 7 * 24 * 60 * 60 * 1000 // Last week
        );
        
        if (recentFraud.length < 10) return;
        
        // Analyze common fraud characteristics
        const fraudCharacteristics = this.analyzeFraudCharacteristics(recentFraud);
        
        // Update fraud indicators weights based on effectiveness
        this.adjustFraudIndicatorWeights(fraudCharacteristics);
        
        this.logger.info('Updated fraud detection patterns based on recent data');
    }

    analyzeFraudCharacteristics(fraudCases) {
        // Analyze common patterns in fraud cases
        const characteristics = {
            commonReasons: {},
            averageRiskScore: 0,
            timePatterns: {},
            locationPatterns: {}
        };
        
        fraudCases.forEach(fraudCase => {
            // Count reasons
            characteristics.commonReasons[fraudCase.reason] = 
                (characteristics.commonReasons[fraudCase.reason] || 0) + 1;
            
            // Average risk score
            characteristics.averageRiskScore += fraudCase.riskScore;
            
            // Time patterns
            const hour = new Date(fraudCase.timestamp).getHours();
            characteristics.timePatterns[hour] = 
                (characteristics.timePatterns[hour] || 0) + 1;
        });
        
        characteristics.averageRiskScore /= fraudCases.length;
        
        return characteristics;
    }

    adjustFraudIndicatorWeights(characteristics) {
        // Adjust weights based on which indicators are most effective
        Object.keys(characteristics.commonReasons).forEach(reason => {
            if (this.fraudIndicators[reason]) {
                const frequency = characteristics.commonReasons[reason];
                // Increase weight for frequently triggered indicators
                this.fraudIndicators[reason] = Math.min(1.0, 
                    this.fraudIndicators[reason] + (frequency * 0.01)
                );
            }
        });
    }

    generateAnalysisId() {
        return `fraud_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    updateMetrics(fraudDetected) {
        this.metrics.totalCalls++;
        if (fraudDetected) {
            this.metrics.fraudDetected++;
        }
    }

    getStatus() {
        const fraudRate = this.metrics.totalCalls > 0 ? 
            this.metrics.fraudDetected / this.metrics.totalCalls : 0;
        
        return {
            initialized: this.isInitialized,
            totalCalls: this.metrics.totalCalls,
            fraudDetected: this.metrics.fraudDetected,
            fraudRate: fraudRate,
            blacklistSize: this.blacklist.size,
            whitelistSize: this.whitelist.size,
            activeHistoryEntries: this.callHistory.size,
            fraudPatterns: this.fraudPatterns.length,
            modelLoaded: this.model !== null
        };
    }

    async shutdown() {
        this.logger.info('Shutting down Fraud Detector...');
        
        if (this.model) {
            this.model.dispose();
        }
        
        this.removeAllListeners();
        this.isInitialized = false;
    }
}

module.exports = FraudDetector;