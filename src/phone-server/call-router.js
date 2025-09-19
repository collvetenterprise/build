const tf = require('@tensorflow/tfjs-node');
const EventEmitter = require('events');
const Logger = require('../shared/logger');

/**
 * Intelligent Call Routing System
 * Uses AI to analyze caller intent and route calls optimally
 */
class IntelligentCallRouter extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            modelPath: config.modelPath || './models/call-routing-model.json',
            confidenceThreshold: config.confidenceThreshold || 0.8,
            routingRules: config.routingRules || {},
            ...config
        };
        
        this.logger = new Logger('CallRouter');
        this.model = null;
        this.isInitialized = false;
        this.routingHistory = [];
        this.performanceMetrics = {
            totalCalls: 0,
            successfulRoutes: 0,
            averageRouteTime: 0,
            customerSatisfactionScore: 0
        };
    }

    async initialize() {
        try {
            this.logger.info('Initializing Intelligent Call Router...');
            
            // Load or create the AI model
            await this.loadModel();
            
            // Start performance monitoring
            this.startPerformanceMonitoring();
            
            this.isInitialized = true;
            this.logger.info('Call Router initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Call Router:', error);
            throw error;
        }
    }

    async loadModel() {
        try {
            // Try to load existing model
            this.model = await tf.loadLayersModel(`file://${this.config.modelPath}`);
            this.logger.info('Loaded existing call routing model');
        } catch (error) {
            // Create new model if none exists
            this.logger.info('Creating new call routing model...');
            this.model = this.createCallRoutingModel();
            await this.trainInitialModel();
        }
    }

    createCallRoutingModel() {
        // Neural network for call routing decisions
        const model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [10], // Features: caller history, time, intent, etc.
                    units: 64,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 32,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: 16,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: 5, // Number of routing destinations
                    activation: 'softmax'
                })
            ]
        });

        model.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        return model;
    }

    async trainInitialModel() {
        // Generate synthetic training data for initial model
        const trainingData = this.generateTrainingData(1000);
        
        const xs = tf.tensor2d(trainingData.features);
        const ys = tf.tensor2d(trainingData.labels);

        await this.model.fit(xs, ys, {
            epochs: 50,
            batchSize: 32,
            validationSplit: 0.2,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    if (epoch % 10 === 0) {
                        this.logger.info(`Training epoch ${epoch}: loss=${logs.loss.toFixed(4)}, accuracy=${logs.acc.toFixed(4)}`);
                    }
                }
            }
        });

        xs.dispose();
        ys.dispose();
        
        this.logger.info('Initial model training completed');
    }

    generateTrainingData(numSamples) {
        const features = [];
        const labels = [];

        for (let i = 0; i < numSamples; i++) {
            // Generate synthetic call features
            const feature = [
                Math.random(), // caller_history_score
                Math.random() * 24, // time_of_day
                Math.random(), // urgency_score
                Math.random(), // language_preference
                Math.random(), // technical_complexity
                Math.random(), // customer_tier
                Math.random(), // call_volume_factor
                Math.random(), // agent_availability
                Math.random(), // previous_satisfaction
                Math.random()  // estimated_duration
            ];

            // Generate corresponding routing decision
            const routingDecision = this.generateOptimalRouting(feature);
            
            features.push(feature);
            labels.push(routingDecision);
        }

        return { features, labels };
    }

    generateOptimalRouting(features) {
        // Simulate optimal routing logic for training
        const [historyScore, timeOfDay, urgency, language, complexity, tier] = features;
        
        const routing = [0, 0, 0, 0, 0]; // 5 possible destinations
        
        if (urgency > 0.8) {
            routing[0] = 1; // Priority support
        } else if (complexity > 0.7) {
            routing[1] = 1; // Technical support
        } else if (tier > 0.6) {
            routing[2] = 1; // Premium support
        } else if (timeOfDay >= 9 && timeOfDay <= 17) {
            routing[3] = 1; // General support
        } else {
            routing[4] = 1; // After-hours support
        }
        
        return routing;
    }

    async routeCall(callData) {
        if (!this.isInitialized) {
            throw new Error('Call Router not initialized');
        }

        const startTime = Date.now();
        
        try {
            // Extract features from call data
            const features = this.extractCallFeatures(callData);
            
            // Get AI prediction
            const prediction = await this.predictOptimalRoute(features);
            
            // Apply business rules and constraints
            const finalRoute = this.applyBusinessRules(prediction, callData);
            
            // Log routing decision
            const routingTime = Date.now() - startTime;
            this.logRoutingDecision(callData, finalRoute, routingTime);
            
            // Update performance metrics
            this.updateMetrics(routingTime, true);
            
            this.emit('callRouted', { callData, route: finalRoute, routingTime });
            
            return {
                success: true,
                route: finalRoute,
                confidence: prediction.confidence,
                routingTime,
                recommendations: this.generateRecommendations(features, finalRoute)
            };
            
        } catch (error) {
            this.logger.error('Call routing failed:', error);
            this.updateMetrics(Date.now() - startTime, false);
            
            // Fallback to default routing
            const fallbackRoute = this.getFallbackRoute(callData);
            
            return {
                success: false,
                route: fallbackRoute,
                error: error.message,
                fallback: true
            };
        }
    }

    extractCallFeatures(callData) {
        return [
            callData.callerHistory?.satisfactionScore || 0.5,
            new Date(callData.timestamp).getHours(),
            callData.urgencyLevel || 0.5,
            callData.languagePreference === 'en' ? 1 : 0,
            callData.issueComplexity || 0.5,
            callData.customerTier || 0.5,
            callData.currentCallVolume || 0.5,
            callData.agentAvailability || 0.5,
            callData.previousSatisfaction || 0.5,
            callData.estimatedDuration || 0.5
        ];
    }

    async predictOptimalRoute(features) {
        const input = tf.tensor2d([features]);
        const prediction = this.model.predict(input);
        const probabilities = await prediction.data();
        
        input.dispose();
        prediction.dispose();
        
        // Find the route with highest probability
        const maxIndex = probabilities.indexOf(Math.max(...probabilities));
        const confidence = probabilities[maxIndex];
        
        return {
            routeIndex: maxIndex,
            confidence,
            probabilities: Array.from(probabilities)
        };
    }

    applyBusinessRules(prediction, callData) {
        const routes = [
            'priority-support',
            'technical-support', 
            'premium-support',
            'general-support',
            'after-hours-support'
        ];
        
        let selectedRoute = routes[prediction.routeIndex];
        
        // Apply business constraints
        if (callData.agentAvailability?.[selectedRoute] === 0) {
            // Find alternative route with available agents
            for (let i = 0; i < routes.length; i++) {
                if (callData.agentAvailability?.[routes[i]] > 0) {
                    selectedRoute = routes[i];
                    break;
                }
            }
        }
        
        // Check confidence threshold
        if (prediction.confidence < this.config.confidenceThreshold) {
            selectedRoute = 'general-support'; // Safe default
        }
        
        return {
            destination: selectedRoute,
            agent: this.selectBestAgent(selectedRoute, callData),
            priority: this.calculatePriority(callData),
            estimatedWaitTime: this.estimateWaitTime(selectedRoute)
        };
    }

    selectBestAgent(route, callData) {
        // Simulate agent selection logic
        const availableAgents = callData.agentAvailability?.[route] || [];
        
        if (availableAgents.length === 0) {
            return null;
        }
        
        // Score agents based on caller needs
        const scoredAgents = availableAgents.map(agent => ({
            ...agent,
            score: this.calculateAgentScore(agent, callData)
        }));
        
        // Return best scoring agent
        return scoredAgents.sort((a, b) => b.score - a.score)[0];
    }

    calculateAgentScore(agent, callData) {
        let score = 0;
        
        // Language matching
        if (agent.languages?.includes(callData.languagePreference)) {
            score += 0.3;
        }
        
        // Skill matching
        if (agent.skills?.includes(callData.issueCategory)) {
            score += 0.4;
        }
        
        // Performance history
        score += (agent.customerSatisfactionScore || 0.5) * 0.3;
        
        return score;
    }

    calculatePriority(callData) {
        let priority = 5; // Default priority
        
        if (callData.customerTier > 0.8) priority -= 2; // Premium customers
        if (callData.urgencyLevel > 0.8) priority -= 2; // Urgent issues
        if (callData.callerHistory?.escalations > 2) priority -= 1; // Repeat issues
        
        return Math.max(1, priority);
    }

    estimateWaitTime(route) {
        // Simulate wait time estimation
        const baseTimes = {
            'priority-support': 30,
            'technical-support': 120,
            'premium-support': 60,
            'general-support': 180,
            'after-hours-support': 300
        };
        
        return baseTimes[route] || 180;
    }

    generateRecommendations(features, route) {
        const recommendations = [];
        
        if (features[2] > 0.8) { // High urgency
            recommendations.push('Consider escalation path if wait time exceeds 2 minutes');
        }
        
        if (features[5] > 0.8) { // Premium customer
            recommendations.push('Offer callback option to maintain service level');
        }
        
        if (features[4] > 0.7) { // High complexity
            recommendations.push('Prepare technical documentation for agent');
        }
        
        return recommendations;
    }

    getFallbackRoute(callData) {
        return {
            destination: 'general-support',
            agent: null,
            priority: 5,
            estimatedWaitTime: 300
        };
    }

    logRoutingDecision(callData, route, routingTime) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            callId: callData.callId,
            callerPhone: callData.callerPhone,
            route: route.destination,
            agentId: route.agent?.id,
            routingTime,
            confidence: route.confidence
        };
        
        this.routingHistory.push(logEntry);
        
        // Keep only last 10000 entries
        if (this.routingHistory.length > 10000) {
            this.routingHistory = this.routingHistory.slice(-10000);
        }
    }

    updateMetrics(routingTime, success) {
        this.performanceMetrics.totalCalls++;
        
        if (success) {
            this.performanceMetrics.successfulRoutes++;
        }
        
        // Update average routing time
        const currentAvg = this.performanceMetrics.averageRouteTime;
        const totalCalls = this.performanceMetrics.totalCalls;
        this.performanceMetrics.averageRouteTime = 
            (currentAvg * (totalCalls - 1) + routingTime) / totalCalls;
    }

    startPerformanceMonitoring() {
        // Monitor and retrain model periodically
        setInterval(() => {
            this.analyzePerformance();
        }, 300000); // Every 5 minutes
    }

    analyzePerformance() {
        const recentCalls = this.routingHistory.slice(-100);
        
        if (recentCalls.length < 50) return;
        
        // Calculate success rate
        const successRate = this.performanceMetrics.successfulRoutes / 
                           this.performanceMetrics.totalCalls;
        
        // Log performance metrics
        this.logger.info('Performance Analysis:', {
            totalCalls: this.performanceMetrics.totalCalls,
            successRate: (successRate * 100).toFixed(2) + '%',
            averageRouteTime: this.performanceMetrics.averageRouteTime.toFixed(2) + 'ms'
        });
        
        // Trigger retraining if performance degrades
        if (successRate < 0.95) {
            this.logger.warn('Performance degradation detected, scheduling model retraining');
            this.scheduleRetraining();
        }
    }

    async scheduleRetraining() {
        // Retrain model with recent data
        setTimeout(async () => {
            try {
                await this.retrainModel();
                this.logger.info('Model retraining completed');
            } catch (error) {
                this.logger.error('Model retraining failed:', error);
            }
        }, 5000);
    }

    async retrainModel() {
        if (this.routingHistory.length < 100) return;
        
        // Prepare training data from routing history
        const trainingData = this.prepareRetrainingData();
        
        const xs = tf.tensor2d(trainingData.features);
        const ys = tf.tensor2d(trainingData.labels);
        
        // Retrain with recent data
        await this.model.fit(xs, ys, {
            epochs: 10,
            batchSize: 16,
            validationSplit: 0.1
        });
        
        xs.dispose();
        ys.dispose();
    }

    prepareRetrainingData() {
        // Convert routing history to training format
        const features = [];
        const labels = [];
        
        for (const entry of this.routingHistory.slice(-1000)) {
            // Reconstruct features (simplified for demo)
            const feature = [
                Math.random(), // Placeholder features
                Math.random(),
                Math.random(),
                Math.random(),
                Math.random(),
                Math.random(),
                Math.random(),
                Math.random(),
                Math.random(),
                Math.random()
            ];
            
            // Convert route to label
            const routes = ['priority-support', 'technical-support', 'premium-support', 'general-support', 'after-hours-support'];
            const routeIndex = routes.indexOf(entry.route);
            const label = new Array(5).fill(0);
            if (routeIndex >= 0) label[routeIndex] = 1;
            
            features.push(feature);
            labels.push(label);
        }
        
        return { features, labels };
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            totalCalls: this.performanceMetrics.totalCalls,
            successRate: this.performanceMetrics.totalCalls > 0 ? 
                (this.performanceMetrics.successfulRoutes / this.performanceMetrics.totalCalls) : 0,
            averageRouteTime: this.performanceMetrics.averageRouteTime,
            modelLoaded: this.model !== null
        };
    }

    async shutdown() {
        this.logger.info('Shutting down Call Router...');
        
        if (this.model) {
            this.model.dispose();
        }
        
        this.removeAllListeners();
        this.isInitialized = false;
    }
}

module.exports = IntelligentCallRouter;