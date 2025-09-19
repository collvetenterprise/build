const tf = require('@tensorflow/tfjs');
const EventEmitter = require('events');
const Logger = require('../shared/logger');

/**
 * Smart Traffic Management System
 * Uses AI to optimize network traffic, bandwidth allocation, and congestion control
 */
class TrafficManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            modelPath: config.modelPath || './models/traffic-model.json',
            optimizationInterval: config.optimizationInterval || 30000, // 30 seconds
            bandwidthThreshold: config.bandwidthThreshold || 0.8,
            latencyThreshold: config.latencyThreshold || 100, // ms
            maxConnections: config.maxConnections || 10000,
            ...config
        };
        
        this.logger = new Logger('TrafficManager');
        this.model = null;
        this.isInitialized = false;
        this.isOptimizing = false;
        
        // Traffic monitoring data
        this.trafficData = {
            totalBandwidth: 1000, // Mbps
            currentUsage: 0,
            connections: 0,
            avgLatency: 0,
            packetLoss: 0,
            throughput: 0
        };
        
        // QoS classes and their priorities
        this.qosClasses = {
            'voice': { priority: 1, minBandwidth: 64, maxLatency: 150 },
            'video': { priority: 2, minBandwidth: 256, maxLatency: 200 },
            'business_critical': { priority: 3, minBandwidth: 128, maxLatency: 100 },
            'web_browsing': { priority: 4, minBandwidth: 32, maxLatency: 500 },
            'file_transfer': { priority: 5, minBandwidth: 16, maxLatency: 1000 },
            'background': { priority: 6, minBandwidth: 8, maxLatency: 2000 }
        };
        
        // Active flows and their classifications
        this.activeFlows = new Map();
        this.bandwidthAllocations = new Map();
        
        // Traffic history for learning
        this.trafficHistory = [];
        this.optimizationHistory = [];
        
        this.metrics = {
            totalOptimizations: 0,
            congestionEvents: 0,
            averageLatencyImprovement: 0,
            bandwidthUtilizationImprovement: 0
        };
    }

    async initialize() {
        try {
            this.logger.info('Initializing Smart Traffic Manager...');
            
            // Load traffic optimization model
            await this.loadTrafficModel();
            
            // Initialize QoS policies
            this.initializeQoSPolicies();
            
            // Start traffic monitoring
            this.startTrafficMonitoring();
            
            // Start optimization engine
            this.startOptimizationEngine();
            
            this.isInitialized = true;
            this.logger.info('Smart Traffic Manager initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Traffic Manager:', error);
            throw error;
        }
    }

    async loadTrafficModel() {
        try {
            // Try to load existing model
            this.model = await tf.loadLayersModel(`file://${this.config.modelPath}`);
            this.logger.info('Loaded existing traffic optimization model');
        } catch (error) {
            // Create new model if none exists
            this.logger.info('Creating new traffic optimization model...');
            this.model = this.createTrafficModel();
            await this.trainTrafficModel();
        }
    }

    createTrafficModel() {
        // Neural network for traffic optimization decisions
        const model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [12], // Traffic features
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
                    units: 6, // Number of QoS classes
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

    async trainTrafficModel() {
        // Generate training data for traffic optimization
        const trainingData = this.generateTrafficTrainingData(3000);
        
        const xs = tf.tensor2d(trainingData.features);
        const ys = tf.tensor2d(trainingData.labels);

        await this.model.fit(xs, ys, {
            epochs: 50,
            batchSize: 64,
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
        
        this.logger.info('Traffic optimization model training completed');
    }

    generateTrafficTrainingData(numSamples) {
        const features = [];
        const labels = [];
        const qosClassNames = Object.keys(this.qosClasses);

        for (let i = 0; i < numSamples; i++) {
            // Generate network conditions
            const bandwidthUsage = Math.random();
            const latency = Math.random() * 500 + 10;
            const packetLoss = Math.random() * 0.1;
            const connectionCount = Math.random() * 10000;
            const timeOfDay = Math.random() * 24;
            const dayOfWeek = Math.random() * 7;
            
            // Generate flow characteristics
            const flowSize = Math.random() * 1000000; // bytes
            const flowDuration = Math.random() * 3600; // seconds
            const sourcePort = Math.random() * 65536;
            const protocol = Math.random() > 0.5 ? 1 : 0; // TCP/UDP
            const priority = Math.random();
            const burstiness = Math.random();
            
            const feature = [
                bandwidthUsage,
                latency / 1000, // Normalize
                packetLoss,
                connectionCount / 10000, // Normalize
                timeOfDay / 24,
                dayOfWeek / 7,
                Math.log(flowSize + 1) / 20, // Log normalize
                flowDuration / 3600,
                sourcePort / 65536,
                protocol,
                priority,
                burstiness
            ];
            
            // Determine optimal QoS class based on characteristics
            const optimalClass = this.determineOptimalQoSClass(feature);
            const label = new Array(qosClassNames.length).fill(0);
            const classIndex = qosClassNames.indexOf(optimalClass);
            if (classIndex >= 0) label[classIndex] = 1;
            
            features.push(feature);
            labels.push(label);
        }

        return { features, labels };
    }

    determineOptimalQoSClass(features) {
        const [bandwidthUsage, latency, packetLoss, connections, timeOfDay, dayOfWeek, 
               flowSize, flowDuration, sourcePort, protocol, priority, burstiness] = features;
        
        // Voice traffic characteristics
        if (sourcePort * 65536 >= 5060 && sourcePort * 65536 <= 5070) return 'voice'; // SIP
        if (latency < 0.15 && flowSize < 0.1 && protocol === 0) return 'voice'; // UDP, small, low latency
        
        // Video traffic characteristics
        if (sourcePort * 65536 >= 1024 && sourcePort * 65536 <= 5000 && flowSize > 0.5) return 'video';
        if (protocol === 0 && flowSize > 0.3 && burstiness > 0.7) return 'video';
        
        // Business critical during business hours
        if (timeOfDay >= 0.33 && timeOfDay <= 0.71 && priority > 0.7) return 'business_critical'; // 8AM-5PM
        
        // Web browsing characteristics
        if (sourcePort * 65536 === 80 || sourcePort * 65536 === 443) return 'web_browsing'; // HTTP/HTTPS
        if (protocol === 1 && flowSize < 0.3 && flowDuration < 0.1) return 'web_browsing';
        
        // File transfer characteristics
        if (flowSize > 0.8 && flowDuration > 0.5) return 'file_transfer';
        if (sourcePort * 65536 >= 20 && sourcePort * 65536 <= 22) return 'file_transfer'; // FTP
        
        // Background traffic
        return 'background';
    }

    initializeQoSPolicies() {
        // Initialize bandwidth allocations for each QoS class
        const totalClasses = Object.keys(this.qosClasses).length;
        let remainingBandwidth = this.trafficData.totalBandwidth;
        
        Object.entries(this.qosClasses).forEach(([className, qosClass]) => {
            // Allocate minimum bandwidth
            const minAllocation = qosClass.minBandwidth;
            this.bandwidthAllocations.set(className, {
                allocated: minAllocation,
                used: 0,
                flows: [],
                priority: qosClass.priority
            });
            remainingBandwidth -= minAllocation;
        });
        
        // Distribute remaining bandwidth based on priority
        this.redistributeBandwidth(remainingBandwidth);
        
        this.logger.info('QoS policies initialized with bandwidth allocations');
    }

    redistributeBandwidth(availableBandwidth) {
        // Sort classes by priority (lower number = higher priority)
        const sortedClasses = Object.entries(this.qosClasses)
            .sort(([, a], [, b]) => a.priority - b.priority);
        
        let remaining = availableBandwidth;
        
        sortedClasses.forEach(([className, qosClass]) => {
            if (remaining <= 0) return;
            
            const allocation = this.bandwidthAllocations.get(className);
            const demand = this.calculateClassDemand(className);
            const additionalBandwidth = Math.min(remaining, demand * 0.5);
            
            allocation.allocated += additionalBandwidth;
            remaining -= additionalBandwidth;
        });
    }

    calculateClassDemand(className) {
        const allocation = this.bandwidthAllocations.get(className);
        if (!allocation || allocation.flows.length === 0) return 0;
        
        // Calculate demand based on active flows
        return allocation.flows.reduce((demand, flow) => {
            return demand + (flow.requestedBandwidth || 10); // Default 10 Mbps if not specified
        }, 0);
    }

    startTrafficMonitoring() {
        // Monitor network traffic every 5 seconds
        setInterval(() => {
            this.collectTrafficMetrics();
        }, 5000);
        
        this.logger.info('Traffic monitoring started');
    }

    collectTrafficMetrics() {
        // Simulate collecting real network metrics
        const previousUsage = this.trafficData.currentUsage;
        
        this.trafficData = {
            totalBandwidth: this.trafficData.totalBandwidth,
            currentUsage: this.simulateTrafficMetric(this.trafficData.currentUsage, 50, 0, this.trafficData.totalBandwidth),
            connections: Math.floor(this.simulateTrafficMetric(this.trafficData.connections, 100, 0, this.config.maxConnections)),
            avgLatency: this.simulateTrafficMetric(this.trafficData.avgLatency, 10, 5, 500),
            packetLoss: this.simulateTrafficMetric(this.trafficData.packetLoss, 0.001, 0, 0.1),
            throughput: this.calculateThroughput(),
            timestamp: Date.now()
        };
        
        // Add to history
        this.trafficHistory.push({ ...this.trafficData });
        
        // Keep only recent history (last hour)
        if (this.trafficHistory.length > 720) { // 60 minutes * 12 samples per minute
            this.trafficHistory = this.trafficHistory.slice(-720);
        }
        
        // Check for congestion
        this.detectCongestion();
        
        // Emit metrics event
        this.emit('trafficMetrics', this.trafficData);
    }

    simulateTrafficMetric(currentValue, variance, min, max) {
        const change = (Math.random() - 0.5) * variance * 2;
        const newValue = currentValue + change;
        return Math.max(min, Math.min(max, newValue));
    }

    calculateThroughput() {
        // Calculate effective throughput considering packet loss
        const utilizationRatio = this.trafficData.currentUsage / this.trafficData.totalBandwidth;
        const lossImpact = 1 - (this.trafficData.packetLoss * 10); // Packet loss severely impacts throughput
        const latencyImpact = Math.max(0.1, 1 - (this.trafficData.avgLatency / 1000)); // High latency reduces throughput
        
        return this.trafficData.currentUsage * lossImpact * latencyImpact;
    }

    detectCongestion() {
        const utilizationRatio = this.trafficData.currentUsage / this.trafficData.totalBandwidth;
        const isHighLatency = this.trafficData.avgLatency > this.config.latencyThreshold;
        const isHighLoss = this.trafficData.packetLoss > 0.02;
        
        if (utilizationRatio > this.config.bandwidthThreshold || isHighLatency || isHighLoss) {
            this.metrics.congestionEvents++;
            
            const congestionEvent = {
                timestamp: Date.now(),
                type: 'congestion',
                severity: utilizationRatio > 0.95 ? 'critical' : utilizationRatio > 0.9 ? 'high' : 'medium',
                metrics: { ...this.trafficData },
                triggers: {
                    highBandwidthUsage: utilizationRatio > this.config.bandwidthThreshold,
                    highLatency: isHighLatency,
                    highPacketLoss: isHighLoss
                }
            };
            
            this.emit('congestionDetected', congestionEvent);
            this.logger.warn(`Congestion detected: ${congestionEvent.severity} severity`);
            
            // Trigger immediate optimization
            this.triggerEmergencyOptimization(congestionEvent);
        }
    }

    async triggerEmergencyOptimization(congestionEvent) {
        this.logger.info('Triggering emergency traffic optimization...');
        
        try {
            // Apply emergency traffic shaping
            await this.applyEmergencyTrafficShaping(congestionEvent);
            
            // Redistribute bandwidth
            this.emergencyBandwidthReallocation();
            
            // Drop low-priority connections if necessary
            if (congestionEvent.severity === 'critical') {
                this.dropLowPriorityConnections();
            }
            
            this.logger.info('Emergency optimization completed');
            
        } catch (error) {
            this.logger.error('Emergency optimization failed:', error);
        }
    }

    async applyEmergencyTrafficShaping(congestionEvent) {
        // Reduce bandwidth for lower priority classes
        const reductionFactor = congestionEvent.severity === 'critical' ? 0.5 : 0.7;
        
        ['background', 'file_transfer', 'web_browsing'].forEach(className => {
            const allocation = this.bandwidthAllocations.get(className);
            if (allocation) {
                const minBandwidth = this.qosClasses[className].minBandwidth;
                allocation.allocated = Math.max(minBandwidth, allocation.allocated * reductionFactor);
            }
        });
        
        this.logger.info(`Applied emergency traffic shaping with ${((1-reductionFactor)*100).toFixed(0)}% reduction`);
    }

    emergencyBandwidthReallocation() {
        // Calculate freed bandwidth from emergency shaping
        let freedBandwidth = 0;
        
        ['background', 'file_transfer', 'web_browsing'].forEach(className => {
            const allocation = this.bandwidthAllocations.get(className);
            const qosClass = this.qosClasses[className];
            if (allocation && allocation.allocated > qosClass.minBandwidth) {
                const reduction = allocation.allocated - qosClass.minBandwidth;
                freedBandwidth += reduction * 0.3; // Only reallocate 30% to maintain some buffer
            }
        });
        
        // Redistribute to high-priority classes
        ['voice', 'video', 'business_critical'].forEach(className => {
            const allocation = this.bandwidthAllocations.get(className);
            if (allocation && freedBandwidth > 0) {
                const additionalBandwidth = freedBandwidth / 3; // Equal distribution
                allocation.allocated += additionalBandwidth;
                freedBandwidth -= additionalBandwidth;
            }
        });
    }

    dropLowPriorityConnections() {
        // Simulate dropping background connections during critical congestion
        let droppedConnections = 0;
        
        this.activeFlows.forEach((flow, flowId) => {
            if (flow.qosClass === 'background' && Math.random() < 0.3) {
                this.activeFlows.delete(flowId);
                droppedConnections++;
            }
        });
        
        this.logger.warn(`Dropped ${droppedConnections} low-priority connections during critical congestion`);
    }

    startOptimizationEngine() {
        if (this.isOptimizing) return;
        
        this.isOptimizing = true;
        this.optimizationInterval = setInterval(async () => {
            try {
                await this.optimizeTraffic();
            } catch (error) {
                this.logger.error('Traffic optimization failed:', error);
            }
        }, this.config.optimizationInterval);
        
        this.logger.info('Traffic optimization engine started');
    }

    async optimizeTraffic(flowData = null) {
        if (!this.isInitialized) {
            throw new Error('Traffic Manager not initialized');
        }

        const startTime = Date.now();
        
        try {
            // Collect current network state
            const networkState = this.analyzeNetworkState();
            
            // Classify flows and predict optimal routing
            const optimizedRouting = await this.optimizeFlowRouting(flowData);
            
            // Update QoS policies
            const qosUpdates = this.updateQoSPolicies(networkState);
            
            // Apply bandwidth allocations
            const bandwidthOptimization = this.optimizeBandwidthAllocation();
            
            // Calculate performance improvements
            const improvements = this.calculateOptimizationImprovements();
            
            // Update metrics
            this.metrics.totalOptimizations++;
            this.updateOptimizationMetrics(improvements);
            
            const optimizationResult = {
                timestamp: Date.now(),
                processingTime: Date.now() - startTime,
                networkState,
                optimizedRouting,
                qosUpdates,
                bandwidthOptimization,
                improvements,
                success: true
            };
            
            // Record optimization history
            this.optimizationHistory.push(optimizationResult);
            if (this.optimizationHistory.length > 100) {
                this.optimizationHistory = this.optimizationHistory.slice(-100);
            }
            
            this.emit('trafficOptimized', optimizationResult);
            
            return optimizationResult;
            
        } catch (error) {
            this.logger.error('Traffic optimization failed:', error);
            return {
                timestamp: Date.now(),
                processingTime: Date.now() - startTime,
                success: false,
                error: error.message
            };
        }
    }

    analyzeNetworkState() {
        return {
            utilizationRatio: this.trafficData.currentUsage / this.trafficData.totalBandwidth,
            latencyStatus: this.trafficData.avgLatency > this.config.latencyThreshold ? 'high' : 'normal',
            packetLossStatus: this.trafficData.packetLoss > 0.02 ? 'high' : 'normal',
            connectionLoad: this.trafficData.connections / this.config.maxConnections,
            throughputEfficiency: this.trafficData.throughput / this.trafficData.currentUsage,
            congestionLevel: this.calculateCongestionLevel(),
            peakHours: this.isPeakHours(),
            activeFlows: this.activeFlows.size
        };
    }

    calculateCongestionLevel() {
        const utilizationScore = this.trafficData.currentUsage / this.trafficData.totalBandwidth;
        const latencyScore = Math.min(1, this.trafficData.avgLatency / 500);
        const lossScore = Math.min(1, this.trafficData.packetLoss / 0.1);
        
        return (utilizationScore + latencyScore + lossScore) / 3;
    }

    isPeakHours() {
        const hour = new Date().getHours();
        return (hour >= 9 && hour <= 17) || (hour >= 19 && hour <= 22); // Business hours or evening
    }

    async optimizeFlowRouting(newFlowData) {
        const routingDecisions = [];
        
        // Process new flow if provided
        if (newFlowData) {
            const classification = await this.classifyFlow(newFlowData);
            routingDecisions.push(classification);
        }
        
        // Reclassify existing flows if network conditions changed significantly
        if (this.shouldReclassifyFlows()) {
            for (const [flowId, flow] of this.activeFlows.entries()) {
                const reclassification = await this.classifyFlow(flow);
                if (reclassification.qosClass !== flow.qosClass) {
                    routingDecisions.push({
                        flowId,
                        oldClass: flow.qosClass,
                        newClass: reclassification.qosClass,
                        reason: 'network_conditions_changed'
                    });
                    flow.qosClass = reclassification.qosClass;
                }
            }
        }
        
        return routingDecisions;
    }

    async classifyFlow(flowData) {
        try {
            // Extract flow features
            const features = this.extractFlowFeatures(flowData);
            
            // Use AI model to classify
            const input = tf.tensor2d([features]);
            const prediction = this.model.predict(input);
            const probabilities = await prediction.data();
            
            input.dispose();
            prediction.dispose();
            
            // Find the QoS class with highest probability
            const qosClassNames = Object.keys(this.qosClasses);
            const maxIndex = probabilities.indexOf(Math.max(...probabilities));
            const confidence = probabilities[maxIndex];
            
            return {
                flowId: flowData.flowId,
                qosClass: qosClassNames[maxIndex],
                confidence,
                features,
                alternatives: this.getAlternativeClasses(probabilities, qosClassNames)
            };
            
        } catch (error) {
            this.logger.error('Flow classification failed:', error);
            return {
                flowId: flowData.flowId,
                qosClass: 'background', // Safe default
                confidence: 0.5,
                error: error.message
            };
        }
    }

    extractFlowFeatures(flowData) {
        const currentTime = Date.now();
        
        return [
            this.trafficData.currentUsage / this.trafficData.totalBandwidth, // Network utilization
            this.trafficData.avgLatency / 1000, // Normalized latency
            this.trafficData.packetLoss, // Packet loss rate
            this.trafficData.connections / this.config.maxConnections, // Connection load
            new Date().getHours() / 24, // Time of day
            new Date().getDay() / 7, // Day of week
            Math.log((flowData.bytes || 1000) + 1) / 20, // Log-normalized flow size
            (flowData.duration || 60) / 3600, // Flow duration in hours
            (flowData.sourcePort || 80) / 65536, // Normalized source port
            flowData.protocol === 'TCP' ? 1 : 0, // Protocol type
            flowData.priority || 0.5, // Application-specified priority
            flowData.burstiness || 0.5 // Traffic burstiness measure
        ];
    }

    getAlternativeClasses(probabilities, classNames) {
        return classNames
            .map((name, index) => ({ class: name, probability: probabilities[index] }))
            .sort((a, b) => b.probability - a.probability)
            .slice(1, 4); // Top 3 alternatives
    }

    shouldReclassifyFlows() {
        // Reclassify if network conditions changed significantly
        if (this.trafficHistory.length < 2) return false;
        
        const current = this.trafficHistory[this.trafficHistory.length - 1];
        const previous = this.trafficHistory[this.trafficHistory.length - 2];
        
        const utilizationChange = Math.abs(current.currentUsage - previous.currentUsage) / this.trafficData.totalBandwidth;
        const latencyChange = Math.abs(current.avgLatency - previous.avgLatency) / previous.avgLatency;
        
        return utilizationChange > 0.1 || latencyChange > 0.2;
    }

    updateQoSPolicies(networkState) {
        const updates = [];
        
        // Adjust policies based on network state
        if (networkState.congestionLevel > 0.7) {
            // Strict QoS during congestion
            updates.push(this.applyStrictQoS());
        } else if (networkState.congestionLevel < 0.3) {
            // Relaxed QoS during low usage
            updates.push(this.applyRelaxedQoS());
        }
        
        // Peak hours adjustments
        if (networkState.peakHours) {
            updates.push(this.applyPeakHoursPolicies());
        }
        
        return updates;
    }

    applyStrictQoS() {
        // Reduce bandwidth for lower priority classes
        ['background', 'file_transfer'].forEach(className => {
            const allocation = this.bandwidthAllocations.get(className);
            if (allocation) {
                const minBandwidth = this.qosClasses[className].minBandwidth;
                allocation.allocated = minBandwidth;
            }
        });
        
        return {
            type: 'strict_qos',
            description: 'Applied strict QoS policies due to high congestion'
        };
    }

    applyRelaxedQoS() {
        // Allow more bandwidth for all classes
        const additionalBandwidth = this.calculateAvailableBandwidth() * 0.8;
        const classCount = Object.keys(this.qosClasses).length;
        const perClassIncrease = additionalBandwidth / classCount;
        
        Object.keys(this.qosClasses).forEach(className => {
            const allocation = this.bandwidthAllocations.get(className);
            if (allocation) {
                allocation.allocated += perClassIncrease;
            }
        });
        
        return {
            type: 'relaxed_qos',
            description: 'Applied relaxed QoS policies due to low network utilization'
        };
    }

    applyPeakHoursPolicies() {
        // Prioritize business traffic during peak hours
        const businessAllocation = this.bandwidthAllocations.get('business_critical');
        const webAllocation = this.bandwidthAllocations.get('web_browsing');
        
        if (businessAllocation && webAllocation) {
            const reallocation = webAllocation.allocated * 0.2;
            webAllocation.allocated -= reallocation;
            businessAllocation.allocated += reallocation;
        }
        
        return {
            type: 'peak_hours_adjustment',
            description: 'Increased business traffic priority during peak hours'
        };
    }

    optimizeBandwidthAllocation() {
        const totalAllocated = Array.from(this.bandwidthAllocations.values())
            .reduce((sum, allocation) => sum + allocation.allocated, 0);
        
        const availableBandwidth = this.trafficData.totalBandwidth - totalAllocated;
        
        if (availableBandwidth > 0) {
            // Distribute available bandwidth based on demand and priority
            this.redistributeBandwidth(availableBandwidth);
        }
        
        return {
            totalAllocated,
            availableBandwidth,
            allocations: Object.fromEntries(
                Array.from(this.bandwidthAllocations.entries()).map(([key, value]) => [
                    key, 
                    { allocated: value.allocated, used: value.used }
                ])
            )
        };
    }

    calculateAvailableBandwidth() {
        const totalAllocated = Array.from(this.bandwidthAllocations.values())
            .reduce((sum, allocation) => sum + allocation.allocated, 0);
        
        return this.trafficData.totalBandwidth - totalAllocated;
    }

    calculateOptimizationImprovements() {
        if (this.optimizationHistory.length < 2) {
            return { latencyImprovement: 0, throughputImprovement: 0 };
        }
        
        const previous = this.optimizationHistory[this.optimizationHistory.length - 2];
        const current = this.trafficData;
        
        const latencyImprovement = ((previous.networkState.avgLatency - current.avgLatency) / previous.networkState.avgLatency) * 100;
        const throughputImprovement = ((current.throughput - previous.networkState.throughput) / previous.networkState.throughput) * 100;
        
        return {
            latencyImprovement: isFinite(latencyImprovement) ? latencyImprovement : 0,
            throughputImprovement: isFinite(throughputImprovement) ? throughputImprovement : 0
        };
    }

    updateOptimizationMetrics(improvements) {
        const totalOptimizations = this.metrics.totalOptimizations;
        
        // Update running averages
        this.metrics.averageLatencyImprovement = 
            (this.metrics.averageLatencyImprovement * (totalOptimizations - 1) + improvements.latencyImprovement) / totalOptimizations;
        
        this.metrics.bandwidthUtilizationImprovement = 
            (this.metrics.bandwidthUtilizationImprovement * (totalOptimizations - 1) + improvements.throughputImprovement) / totalOptimizations;
    }

    // Public API methods
    addFlow(flowData) {
        const flowId = flowData.flowId || this.generateFlowId();
        flowData.flowId = flowId;
        flowData.startTime = Date.now();
        
        this.activeFlows.set(flowId, flowData);
        
        // Trigger optimization for new flow
        this.optimizeTraffic(flowData);
        
        return flowId;
    }

    removeFlow(flowId) {
        const removed = this.activeFlows.delete(flowId);
        if (removed) {
            this.logger.debug(`Removed flow ${flowId}`);
        }
        return removed;
    }

    getFlowStatus(flowId) {
        const flow = this.activeFlows.get(flowId);
        if (!flow) return null;
        
        const allocation = this.bandwidthAllocations.get(flow.qosClass);
        
        return {
            flowId,
            qosClass: flow.qosClass,
            allocatedBandwidth: allocation ? allocation.allocated : 0,
            priority: this.qosClasses[flow.qosClass]?.priority || 6,
            startTime: flow.startTime,
            duration: Date.now() - flow.startTime
        };
    }

    generateFlowId() {
        return `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getStatus() {
        const utilizationRatio = this.trafficData.currentUsage / this.trafficData.totalBandwidth;
        
        return {
            initialized: this.isInitialized,
            optimizing: this.isOptimizing,
            currentTraffic: this.trafficData,
            utilizationRatio,
            activeFlows: this.activeFlows.size,
            qosClasses: Object.keys(this.qosClasses).length,
            bandwidthAllocations: Object.fromEntries(this.bandwidthAllocations),
            metrics: this.metrics,
            congestionLevel: this.calculateCongestionLevel(),
            modelLoaded: this.model !== null
        };
    }

    async shutdown() {
        this.logger.info('Shutting down Traffic Manager...');
        
        this.isOptimizing = false;
        
        if (this.optimizationInterval) {
            clearInterval(this.optimizationInterval);
        }
        
        if (this.model) {
            this.model.dispose();
        }
        
        this.removeAllListeners();
        this.isInitialized = false;
    }
}

module.exports = TrafficManager;