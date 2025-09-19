const tf = require('@tensorflow/tfjs');
const EventEmitter = require('events');
const Logger = require('../shared/logger');

/**
 * Quality of Service (QoS) Optimizer
 * Uses reinforcement learning to continuously optimize network performance
 */
class QoSOptimizer extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            modelPath: config.modelPath || './models/qos-model.json',
            optimizationInterval: config.optimizationInterval || 15000, // 15 seconds
            learningRate: config.learningRate || 0.001,
            explorationRate: config.explorationRate || 0.1,
            rewardThreshold: config.rewardThreshold || 0.8,
            ...config
        };
        
        this.logger = new Logger('QoSOptimizer');
        this.model = null;
        this.isInitialized = false;
        this.isOptimizing = false;
        
        // QoS parameters to optimize
        this.qosParameters = {
            bandwidthAllocation: new Map(),
            priorityQueues: new Map(),
            latencyTargets: new Map(),
            jitterBuffers: new Map(),
            congestionWindows: new Map()
        };
        
        // Service level agreements
        this.slaTargets = {
            'voice': { latency: 150, jitter: 30, packetLoss: 0.01, bandwidth: 64 },
            'video': { latency: 200, jitter: 50, packetLoss: 0.001, bandwidth: 256 },
            'business_critical': { latency: 100, jitter: 20, packetLoss: 0.001, bandwidth: 128 },
            'web_browsing': { latency: 500, jitter: 100, packetLoss: 0.01, bandwidth: 32 },
            'file_transfer': { latency: 1000, jitter: 200, packetLoss: 0.001, bandwidth: 16 },
            'background': { latency: 2000, jitter: 500, packetLoss: 0.02, bandwidth: 8 }
        };
        
        // Performance metrics
        this.performanceMetrics = {
            averageLatency: 0,
            averageJitter: 0,
            packetLossRate: 0,
            throughput: 0,
            utilizationEfficiency: 0,
            slaCompliance: 0
        };
        
        // Reinforcement learning state
        this.rlState = {
            currentState: null,
            lastAction: null,
            lastReward: 0,
            episodeRewards: [],
            explorationRate: this.config.explorationRate
        };
        
        // Action space for RL
        this.actionSpace = {
            'increase_bandwidth': 0,
            'decrease_bandwidth': 1,
            'increase_priority': 2,
            'decrease_priority': 3,
            'adjust_buffer_size': 4,
            'modify_congestion_window': 5,
            'enable_compression': 6,
            'adjust_scheduling': 7
        };
        
        this.optimizationHistory = [];
        this.metrics = {
            totalOptimizations: 0,
            improvementAchieved: 0,
            slaViolations: 0,
            averageReward: 0
        };
    }

    async initialize() {
        try {
            this.logger.info('Initializing QoS Optimizer...');
            
            // Load or create RL model
            await this.loadQoSModel();
            
            // Initialize QoS parameters
            this.initializeQoSParameters();
            
            // Start performance monitoring
            this.startPerformanceMonitoring();
            
            // Start optimization loop
            this.startOptimization();
            
            this.isInitialized = true;
            this.logger.info('QoS Optimizer initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize QoS Optimizer:', error);
            throw error;
        }
    }

    async loadQoSModel() {
        try {
            // Try to load existing model
            this.model = await tf.loadLayersModel(`file://${this.config.modelPath}`);
            this.logger.info('Loaded existing QoS optimization model');
        } catch (error) {
            // Create new model if none exists
            this.logger.info('Creating new QoS optimization model...');
            this.model = this.createQoSModel();
            await this.pretrainModel();
        }
    }

    createQoSModel() {
        // Deep Q-Network for QoS optimization
        const model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [16], // State features
                    units: 128,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 64,
                    activation: 'relu'
                }),
                tf.layers.dropout({ rate: 0.1 }),
                tf.layers.dense({
                    units: 32,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: Object.keys(this.actionSpace).length,
                    activation: 'linear' // Q-values can be negative
                })
            ]
        });

        model.compile({
            optimizer: tf.train.adam(this.config.learningRate),
            loss: 'meanSquaredError'
        });

        return model;
    }

    async pretrainModel() {
        // Generate initial training data for the model
        const trainingData = this.generateInitialTrainingData(1000);
        
        const xs = tf.tensor2d(trainingData.states);
        const ys = tf.tensor2d(trainingData.qValues);

        await this.model.fit(xs, ys, {
            epochs: 50,
            batchSize: 32,
            validationSplit: 0.2,
            verbose: 0
        });

        xs.dispose();
        ys.dispose();
        
        this.logger.info('QoS model pretraining completed');
    }

    generateInitialTrainingData(numSamples) {
        const states = [];
        const qValues = [];

        for (let i = 0; i < numSamples; i++) {
            // Generate random network state
            const state = this.generateRandomState();
            
            // Calculate Q-values based on heuristics
            const qValue = this.calculateHeuristicQValues(state);
            
            states.push(state);
            qValues.push(qValue);
        }

        return { states, qValues };
    }

    generateRandomState() {
        return [
            Math.random() * 1000, // Current latency
            Math.random() * 100,  // Current jitter
            Math.random() * 0.1,  // Current packet loss
            Math.random() * 1000, // Current throughput
            Math.random(),        // Bandwidth utilization
            Math.random(),        // CPU usage
            Math.random(),        // Memory usage
            Math.random(),        // Network congestion level
            Math.random() * 24,   // Time of day
            Math.random() * 1000, // Active connections
            Math.random(),        // Voice traffic ratio
            Math.random(),        // Video traffic ratio
            Math.random(),        // Business critical ratio
            Math.random(),        // Background traffic ratio
            Math.random(),        // SLA compliance score
            Math.random()         // Historical performance
        ];
    }

    calculateHeuristicQValues(state) {
        const [latency, jitter, packetLoss, throughput, utilization] = state;
        const qValues = new Array(Object.keys(this.actionSpace).length).fill(0);
        
        // Heuristic: if latency is high, increasing bandwidth might help
        if (latency > 200) {
            qValues[this.actionSpace['increase_bandwidth']] = 0.8;
            qValues[this.actionSpace['increase_priority']] = 0.6;
        }
        
        // If packet loss is high, adjust congestion window
        if (packetLoss > 0.02) {
            qValues[this.actionSpace['modify_congestion_window']] = 0.7;
            qValues[this.actionSpace['adjust_buffer_size']] = 0.5;
        }
        
        // If utilization is high, enable compression
        if (utilization > 0.8) {
            qValues[this.actionSpace['enable_compression']] = 0.6;
            qValues[this.actionSpace['adjust_scheduling']] = 0.4;
        }
        
        // If performance is good, small adjustments
        if (latency < 100 && packetLoss < 0.01) {
            qValues.forEach((_, index) => {
                qValues[index] = Math.random() * 0.3; // Small random values
            });
        }
        
        return qValues;
    }

    initializeQoSParameters() {
        // Initialize QoS parameters for each service class
        Object.keys(this.slaTargets).forEach(serviceClass => {
            const sla = this.slaTargets[serviceClass];
            
            this.qosParameters.bandwidthAllocation.set(serviceClass, {
                allocated: sla.bandwidth,
                reserved: sla.bandwidth * 0.5,
                maximum: sla.bandwidth * 2
            });
            
            this.qosParameters.priorityQueues.set(serviceClass, {
                priority: this.getDefaultPriority(serviceClass),
                weight: this.getDefaultWeight(serviceClass),
                maxPackets: this.getDefaultBufferSize(serviceClass)
            });
            
            this.qosParameters.latencyTargets.set(serviceClass, {
                target: sla.latency,
                threshold: sla.latency * 1.2,
                critical: sla.latency * 2
            });
            
            this.qosParameters.jitterBuffers.set(serviceClass, {
                size: this.calculateOptimalBufferSize(sla.jitter),
                adaptive: true,
                maxDelay: sla.jitter * 3
            });
            
            this.qosParameters.congestionWindows.set(serviceClass, {
                initial: 64,
                maximum: 1024,
                threshold: 512,
                algorithm: 'cubic'
            });
        });
        
        this.logger.info('QoS parameters initialized');
    }

    getDefaultPriority(serviceClass) {
        const priorities = {
            'voice': 1,
            'video': 2,
            'business_critical': 3,
            'web_browsing': 4,
            'file_transfer': 5,
            'background': 6
        };
        return priorities[serviceClass] || 6;
    }

    getDefaultWeight(serviceClass) {
        const weights = {
            'voice': 50,
            'video': 40,
            'business_critical': 30,
            'web_browsing': 20,
            'file_transfer': 15,
            'background': 10
        };
        return weights[serviceClass] || 10;
    }

    getDefaultBufferSize(serviceClass) {
        const bufferSizes = {
            'voice': 10,
            'video': 50,
            'business_critical': 30,
            'web_browsing': 100,
            'file_transfer': 200,
            'background': 500
        };
        return bufferSizes[serviceClass] || 100;
    }

    calculateOptimalBufferSize(targetJitter) {
        // Calculate buffer size to achieve target jitter
        return Math.max(10, Math.min(100, targetJitter / 10));
    }

    startPerformanceMonitoring() {
        // Monitor network performance every 5 seconds
        setInterval(() => {
            this.updatePerformanceMetrics();
        }, 5000);
        
        this.logger.info('Performance monitoring started');
    }

    updatePerformanceMetrics() {
        // Simulate performance metric collection
        this.performanceMetrics = {
            averageLatency: this.simulateMetric(this.performanceMetrics.averageLatency, 20, 10, 1000),
            averageJitter: this.simulateMetric(this.performanceMetrics.averageJitter, 10, 5, 200),
            packetLossRate: this.simulateMetric(this.performanceMetrics.packetLossRate, 0.001, 0, 0.1),
            throughput: this.simulateMetric(this.performanceMetrics.throughput, 50, 100, 2000),
            utilizationEfficiency: this.calculateUtilizationEfficiency(),
            slaCompliance: this.calculateSLACompliance()
        };
        
        // Emit performance update
        this.emit('performanceUpdate', this.performanceMetrics);
    }

    simulateMetric(currentValue, variance, min, max) {
        const change = (Math.random() - 0.5) * variance * 2;
        const newValue = currentValue + change;
        return Math.max(min, Math.min(max, newValue));
    }

    calculateUtilizationEfficiency() {
        // Calculate how efficiently bandwidth is being used
        const totalAllocated = Array.from(this.qosParameters.bandwidthAllocation.values())
            .reduce((sum, allocation) => sum + allocation.allocated, 0);
        
        const effectiveThroughput = this.performanceMetrics.throughput * 
            (1 - this.performanceMetrics.packetLossRate);
        
        return totalAllocated > 0 ? effectiveThroughput / totalAllocated : 0;
    }

    calculateSLACompliance() {
        let totalCompliance = 0;
        let serviceCount = 0;
        
        Object.entries(this.slaTargets).forEach(([serviceClass, sla]) => {
            serviceCount++;
            
            // Check latency compliance
            const latencyCompliance = this.performanceMetrics.averageLatency <= sla.latency ? 1 : 
                Math.max(0, 1 - (this.performanceMetrics.averageLatency - sla.latency) / sla.latency);
            
            // Check jitter compliance
            const jitterCompliance = this.performanceMetrics.averageJitter <= sla.jitter ? 1 :
                Math.max(0, 1 - (this.performanceMetrics.averageJitter - sla.jitter) / sla.jitter);
            
            // Check packet loss compliance
            const lossCompliance = this.performanceMetrics.packetLossRate <= sla.packetLoss ? 1 :
                Math.max(0, 1 - (this.performanceMetrics.packetLossRate - sla.packetLoss) / sla.packetLoss);
            
            // Average compliance for this service
            const serviceCompliance = (latencyCompliance + jitterCompliance + lossCompliance) / 3;
            totalCompliance += serviceCompliance;
        });
        
        return serviceCount > 0 ? totalCompliance / serviceCount : 0;
    }

    startOptimization() {
        if (this.isOptimizing) return;
        
        this.isOptimizing = true;
        this.optimizationInterval = setInterval(async () => {
            try {
                await this.performOptimization();
            } catch (error) {
                this.logger.error('QoS optimization failed:', error);
            }
        }, this.config.optimizationInterval);
        
        this.logger.info('QoS optimization started');
    }

    async performOptimization() {
        if (!this.isInitialized) return;
        
        const startTime = Date.now();
        
        try {
            // Get current network state
            const currentState = this.getCurrentState();
            
            // Select action using epsilon-greedy policy
            const action = await this.selectAction(currentState);
            
            // Execute the action
            const actionResult = await this.executeAction(action);
            
            // Calculate reward
            const reward = this.calculateReward(actionResult);
            
            // Update the model with experience
            await this.updateModel(this.rlState.currentState, this.rlState.lastAction, reward, currentState);
            
            // Update RL state
            this.rlState.currentState = currentState;
            this.rlState.lastAction = action;
            this.rlState.lastReward = reward;
            this.rlState.episodeRewards.push(reward);
            
            // Decay exploration rate
            this.rlState.explorationRate = Math.max(0.01, this.rlState.explorationRate * 0.995);
            
            // Update metrics
            this.updateOptimizationMetrics(reward, actionResult);
            
            const optimizationResult = {
                timestamp: Date.now(),
                processingTime: Date.now() - startTime,
                state: currentState,
                action: action,
                reward: reward,
                actionResult: actionResult,
                performance: this.performanceMetrics,
                success: true
            };
            
            // Record optimization history
            this.optimizationHistory.push(optimizationResult);
            if (this.optimizationHistory.length > 1000) {
                this.optimizationHistory = this.optimizationHistory.slice(-1000);
            }
            
            this.emit('qosOptimized', optimizationResult);
            
        } catch (error) {
            this.logger.error('Optimization step failed:', error);
        }
    }

    getCurrentState() {
        return [
            this.performanceMetrics.averageLatency,
            this.performanceMetrics.averageJitter,
            this.performanceMetrics.packetLossRate * 1000, // Scale for better learning
            this.performanceMetrics.throughput,
            this.performanceMetrics.utilizationEfficiency,
            this.getCPUUsage(),
            this.getMemoryUsage(),
            this.getCongestionLevel(),
            new Date().getHours(), // Time of day
            this.getActiveConnections(),
            this.getTrafficRatio('voice'),
            this.getTrafficRatio('video'),
            this.getTrafficRatio('business_critical'),
            this.getTrafficRatio('background'),
            this.performanceMetrics.slaCompliance,
            this.getHistoricalPerformance()
        ];
    }

    getCPUUsage() {
        // Simulate CPU usage
        return Math.random() * 0.8 + 0.1;
    }

    getMemoryUsage() {
        // Simulate memory usage
        return Math.random() * 0.7 + 0.2;
    }

    getCongestionLevel() {
        // Calculate congestion based on multiple factors
        const utilizationFactor = this.performanceMetrics.utilizationEfficiency > 0.9 ? 0.8 : 0.2;
        const latencyFactor = this.performanceMetrics.averageLatency > 200 ? 0.6 : 0.1;
        const lossFactor = this.performanceMetrics.packetLossRate > 0.01 ? 0.7 : 0.1;
        
        return Math.min(1, utilizationFactor + latencyFactor + lossFactor);
    }

    getActiveConnections() {
        // Simulate active connections
        return Math.floor(Math.random() * 1000) + 100;
    }

    getTrafficRatio(serviceClass) {
        // Simulate traffic distribution
        const ratios = {
            'voice': 0.15,
            'video': 0.25,
            'business_critical': 0.20,
            'web_browsing': 0.25,
            'file_transfer': 0.10,
            'background': 0.05
        };
        
        const baseRatio = ratios[serviceClass] || 0.1;
        return baseRatio + (Math.random() - 0.5) * 0.1; // Add some variance
    }

    getHistoricalPerformance() {
        // Calculate average performance over recent history
        if (this.optimizationHistory.length === 0) return 0.5;
        
        const recentHistory = this.optimizationHistory.slice(-10);
        const avgReward = recentHistory.reduce((sum, opt) => sum + opt.reward, 0) / recentHistory.length;
        
        return Math.max(0, Math.min(1, (avgReward + 1) / 2)); // Normalize to 0-1
    }

    async selectAction(state) {
        // Epsilon-greedy action selection
        if (Math.random() < this.rlState.explorationRate) {
            // Explore: random action
            const actionNames = Object.keys(this.actionSpace);
            return actionNames[Math.floor(Math.random() * actionNames.length)];
        } else {
            // Exploit: use model prediction
            const stateTensor = tf.tensor2d([state]);
            const qValues = this.model.predict(stateTensor);
            const qValuesArray = await qValues.data();
            
            stateTensor.dispose();
            qValues.dispose();
            
            // Select action with highest Q-value
            const maxIndex = qValuesArray.indexOf(Math.max(...qValuesArray));
            const actionNames = Object.keys(this.actionSpace);
            return actionNames[maxIndex];
        }
    }

    async executeAction(action) {
        const actionResult = {
            action,
            changes: [],
            success: true,
            metrics: {}
        };
        
        try {
            switch (action) {
                case 'increase_bandwidth':
                    await this.increaseBandwidth();
                    actionResult.changes.push('Increased bandwidth allocation');
                    break;
                    
                case 'decrease_bandwidth':
                    await this.decreaseBandwidth();
                    actionResult.changes.push('Decreased bandwidth allocation');
                    break;
                    
                case 'increase_priority':
                    await this.increasePriority();
                    actionResult.changes.push('Increased priority for high-value traffic');
                    break;
                    
                case 'decrease_priority':
                    await this.decreasePriority();
                    actionResult.changes.push('Decreased priority for low-value traffic');
                    break;
                    
                case 'adjust_buffer_size':
                    await this.adjustBufferSizes();
                    actionResult.changes.push('Adjusted buffer sizes');
                    break;
                    
                case 'modify_congestion_window':
                    await this.modifyCongestionWindow();
                    actionResult.changes.push('Modified congestion window parameters');
                    break;
                    
                case 'enable_compression':
                    await this.enableCompression();
                    actionResult.changes.push('Enabled traffic compression');
                    break;
                    
                case 'adjust_scheduling':
                    await this.adjustScheduling();
                    actionResult.changes.push('Adjusted packet scheduling');
                    break;
                    
                default:
                    actionResult.success = false;
                    actionResult.error = `Unknown action: ${action}`;
            }
            
            // Measure immediate impact
            actionResult.metrics = await this.measureActionImpact();
            
        } catch (error) {
            actionResult.success = false;
            actionResult.error = error.message;
            this.logger.error(`Action execution failed: ${action}`, error);
        }
        
        return actionResult;
    }

    async increaseBandwidth() {
        // Increase bandwidth for high-priority services
        ['voice', 'video', 'business_critical'].forEach(serviceClass => {
            const allocation = this.qosParameters.bandwidthAllocation.get(serviceClass);
            if (allocation) {
                const increase = allocation.allocated * 0.1; // 10% increase
                allocation.allocated = Math.min(allocation.maximum, allocation.allocated + increase);
            }
        });
    }

    async decreaseBandwidth() {
        // Decrease bandwidth for low-priority services
        ['background', 'file_transfer'].forEach(serviceClass => {
            const allocation = this.qosParameters.bandwidthAllocation.get(serviceClass);
            if (allocation) {
                const decrease = allocation.allocated * 0.1; // 10% decrease
                allocation.allocated = Math.max(allocation.reserved, allocation.allocated - decrease);
            }
        });
    }

    async increasePriority() {
        // Increase priority for voice and video traffic
        ['voice', 'video'].forEach(serviceClass => {
            const queue = this.qosParameters.priorityQueues.get(serviceClass);
            if (queue && queue.weight < 100) {
                queue.weight = Math.min(100, queue.weight + 5);
            }
        });
    }

    async decreasePriority() {
        // Decrease priority for background traffic
        ['background', 'file_transfer'].forEach(serviceClass => {
            const queue = this.qosParameters.priorityQueues.get(serviceClass);
            if (queue && queue.weight > 1) {
                queue.weight = Math.max(1, queue.weight - 2);
            }
        });
    }

    async adjustBufferSizes() {
        // Adjust buffer sizes based on current jitter
        Object.keys(this.slaTargets).forEach(serviceClass => {
            const buffer = this.qosParameters.jitterBuffers.get(serviceClass);
            const sla = this.slaTargets[serviceClass];
            
            if (buffer && this.performanceMetrics.averageJitter > sla.jitter) {
                // Increase buffer size if jitter is high
                buffer.size = Math.min(buffer.maxDelay / 5, buffer.size * 1.2);
            } else if (buffer && this.performanceMetrics.averageJitter < sla.jitter * 0.5) {
                // Decrease buffer size if jitter is very low
                buffer.size = Math.max(5, buffer.size * 0.9);
            }
        });
    }

    async modifyCongestionWindow() {
        // Adjust congestion window based on packet loss
        Object.keys(this.slaTargets).forEach(serviceClass => {
            const window = this.qosParameters.congestionWindows.get(serviceClass);
            
            if (window) {
                if (this.performanceMetrics.packetLossRate > 0.01) {
                    // Decrease window size if packet loss is high
                    window.threshold = Math.max(32, window.threshold * 0.8);
                } else if (this.performanceMetrics.packetLossRate < 0.001) {
                    // Increase window size if packet loss is very low
                    window.threshold = Math.min(window.maximum, window.threshold * 1.1);
                }
            }
        });
    }

    async enableCompression() {
        // Simulate enabling compression for appropriate traffic
        ['file_transfer', 'background', 'web_browsing'].forEach(serviceClass => {
            // In practice, this would configure compression algorithms
            this.logger.debug(`Enabled compression for ${serviceClass} traffic`);
        });
    }

    async adjustScheduling() {
        // Adjust packet scheduling algorithm parameters
        // This could involve switching between different scheduling algorithms
        // or tuning their parameters
        this.logger.debug('Adjusted packet scheduling parameters');
    }

    async measureActionImpact() {
        // Wait a short time to measure immediate impact
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return {
            latencyChange: this.performanceMetrics.averageLatency,
            jitterChange: this.performanceMetrics.averageJitter,
            lossChange: this.performanceMetrics.packetLossRate,
            throughputChange: this.performanceMetrics.throughput,
            complianceChange: this.performanceMetrics.slaCompliance
        };
    }

    calculateReward(actionResult) {
        if (!actionResult.success) {
            return -0.5; // Penalty for failed actions
        }
        
        let reward = 0;
        
        // Reward based on SLA compliance improvement
        const complianceReward = this.performanceMetrics.slaCompliance * 2 - 1; // Scale to -1 to 1
        reward += complianceReward * 0.4;
        
        // Reward based on latency performance
        const maxAcceptableLatency = 300; // ms
        const latencyReward = Math.max(-1, 1 - this.performanceMetrics.averageLatency / maxAcceptableLatency);
        reward += latencyReward * 0.3;
        
        // Reward based on packet loss
        const maxAcceptablePacketLoss = 0.02;
        const lossReward = Math.max(-1, 1 - this.performanceMetrics.packetLossRate / maxAcceptablePacketLoss);
        reward += lossReward * 0.2;
        
        // Reward based on efficiency
        const efficiencyReward = this.performanceMetrics.utilizationEfficiency * 2 - 1;
        reward += efficiencyReward * 0.1;
        
        // Penalty for SLA violations
        if (this.performanceMetrics.slaCompliance < 0.8) {
            reward -= 0.3;
            this.metrics.slaViolations++;
        }
        
        // Bonus for maintaining good performance
        if (this.performanceMetrics.slaCompliance > 0.95) {
            reward += 0.2;
        }
        
        return Math.max(-1, Math.min(1, reward)); // Clamp to [-1, 1]
    }

    async updateModel(previousState, action, reward, currentState) {
        if (!previousState || action === null) return;
        
        try {
            // Q-learning update
            const gamma = 0.95; // Discount factor
            
            // Get current Q-values for previous state
            const prevStateTensor = tf.tensor2d([previousState]);
            const currentQValues = this.model.predict(prevStateTensor);
            const currentQValuesArray = await currentQValues.data();
            
            // Get max Q-value for current state
            const currStateTensor = tf.tensor2d([currentState]);
            const nextQValues = this.model.predict(currStateTensor);
            const nextQValuesArray = await nextQValues.data();
            const maxNextQ = Math.max(...nextQValuesArray);
            
            // Update Q-value for the action taken
            const actionIndex = this.actionSpace[action];
            const targetQ = reward + gamma * maxNextQ;
            currentQValuesArray[actionIndex] = targetQ;
            
            // Train the model
            const targetTensor = tf.tensor2d([currentQValuesArray]);
            await this.model.fit(prevStateTensor, targetTensor, {
                epochs: 1,
                verbose: 0
            });
            
            // Cleanup tensors
            prevStateTensor.dispose();
            currentQValues.dispose();
            currStateTensor.dispose();
            nextQValues.dispose();
            targetTensor.dispose();
            
        } catch (error) {
            this.logger.error('Model update failed:', error);
        }
    }

    updateOptimizationMetrics(reward, actionResult) {
        this.metrics.totalOptimizations++;
        
        // Update average reward
        const totalOpts = this.metrics.totalOptimizations;
        this.metrics.averageReward = 
            (this.metrics.averageReward * (totalOpts - 1) + reward) / totalOpts;
        
        // Track improvements
        if (reward > this.config.rewardThreshold) {
            this.metrics.improvementAchieved++;
        }
    }

    // Public API methods
    async optimizeForService(serviceClass, targetMetrics) {
        if (!this.slaTargets[serviceClass]) {
            throw new Error(`Unknown service class: ${serviceClass}`);
        }
        
        // Update SLA targets
        this.slaTargets[serviceClass] = { ...this.slaTargets[serviceClass], ...targetMetrics };
        
        // Trigger immediate optimization
        await this.performOptimization();
        
        return {
            serviceClass,
            updatedTargets: this.slaTargets[serviceClass],
            currentMetrics: this.performanceMetrics
        };
    }

    getQoSConfiguration() {
        return {
            bandwidthAllocations: Object.fromEntries(this.qosParameters.bandwidthAllocation),
            priorityQueues: Object.fromEntries(this.qosParameters.priorityQueues),
            latencyTargets: Object.fromEntries(this.qosParameters.latencyTargets),
            jitterBuffers: Object.fromEntries(this.qosParameters.jitterBuffers),
            congestionWindows: Object.fromEntries(this.qosParameters.congestionWindows),
            slaTargets: this.slaTargets
        };
    }

    getPerformanceReport() {
        return {
            currentMetrics: this.performanceMetrics,
            slaCompliance: this.calculateDetailedSLACompliance(),
            optimizationStats: this.metrics,
            recentHistory: this.optimizationHistory.slice(-10),
            reinforcementLearningState: {
                explorationRate: this.rlState.explorationRate,
                averageReward: this.metrics.averageReward,
                recentRewards: this.rlState.episodeRewards.slice(-10)
            }
        };
    }

    calculateDetailedSLACompliance() {
        const compliance = {};
        
        Object.entries(this.slaTargets).forEach(([serviceClass, sla]) => {
            compliance[serviceClass] = {
                latency: {
                    target: sla.latency,
                    current: this.performanceMetrics.averageLatency,
                    compliance: this.performanceMetrics.averageLatency <= sla.latency
                },
                jitter: {
                    target: sla.jitter,
                    current: this.performanceMetrics.averageJitter,
                    compliance: this.performanceMetrics.averageJitter <= sla.jitter
                },
                packetLoss: {
                    target: sla.packetLoss,
                    current: this.performanceMetrics.packetLossRate,
                    compliance: this.performanceMetrics.packetLossRate <= sla.packetLoss
                }
            };
        });
        
        return compliance;
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            optimizing: this.isOptimizing,
            currentMetrics: this.performanceMetrics,
            slaCompliance: this.performanceMetrics.slaCompliance,
            explorationRate: this.rlState.explorationRate,
            metrics: this.metrics,
            modelLoaded: this.model !== null,
            lastOptimization: this.metrics.totalOptimizations > 0 ? Date.now() : null
        };
    }

    async shutdown() {
        this.logger.info('Shutting down QoS Optimizer...');
        
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

module.exports = QoSOptimizer;