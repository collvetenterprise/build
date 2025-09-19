const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const winston = require('winston');
const yaml = require('yaml');
const fs = require('fs');
const path = require('path');

// Import AI modules
const IntelligentCallRouter = require('./phone-server/call-router');
const VoiceProcessor = require('./phone-server/voice-processor');
const FraudDetector = require('./phone-server/fraud-detector');
const PredictiveMaintenanceMonitor = require('./phone-server/predictive-maintenance');

const TrafficManager = require('./internet-gateway/traffic-manager');
const ThreatDetector = require('./internet-gateway/threat-detector');
const QoSOptimizer = require('./internet-gateway/qos-optimizer');
const SelfHealingNetwork = require('./internet-gateway/self-healing');

const Logger = require('./shared/logger');
const ConfigManager = require('./shared/config-manager');

class AIPhoneGatewayService {
    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.logger = new Logger();
        this.config = new ConfigManager();
        this.initializeServices();
    }

    initializeServices() {
        // Initialize Phone Server AI Services
        this.callRouter = new IntelligentCallRouter(this.config.get('phoneServer.callRouting'));
        this.voiceProcessor = new VoiceProcessor(this.config.get('phoneServer.voiceProcessing'));
        this.fraudDetector = new FraudDetector(this.config.get('phoneServer.fraudDetection'));
        this.maintenanceMonitor = new PredictiveMaintenanceMonitor(this.config.get('phoneServer.maintenance'));

        // Initialize Internet Gateway AI Services
        this.trafficManager = new TrafficManager(this.config.get('internetGateway.trafficManagement'));
        this.threatDetector = new ThreatDetector(this.config.get('internetGateway.threatDetection'));
        this.qosOptimizer = new QoSOptimizer(this.config.get('internetGateway.qosOptimization'));
        this.selfHealing = new SelfHealingNetwork(this.config.get('internetGateway.selfHealing'));

        this.setupRoutes();
        this.setupWebSocketHandlers();
    }

    setupRoutes() {
        this.app.use(express.json());
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                services: {
                    phoneServer: this.getPhoneServerStatus(),
                    internetGateway: this.getInternetGatewayStatus()
                }
            });
        });

        // Phone Server endpoints
        this.app.post('/api/phone/route-call', async (req, res) => {
            try {
                const result = await this.callRouter.routeCall(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Call routing error:', error);
                res.status(500).json({ error: 'Call routing failed' });
            }
        });

        this.app.post('/api/phone/process-voice', async (req, res) => {
            try {
                const result = await this.voiceProcessor.processVoice(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Voice processing error:', error);
                res.status(500).json({ error: 'Voice processing failed' });
            }
        });

        // Internet Gateway endpoints
        this.app.post('/api/gateway/optimize-traffic', async (req, res) => {
            try {
                const result = await this.trafficManager.optimizeTraffic(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Traffic optimization error:', error);
                res.status(500).json({ error: 'Traffic optimization failed' });
            }
        });

        this.app.get('/api/gateway/threat-status', async (req, res) => {
            try {
                const status = await this.threatDetector.getCurrentStatus();
                res.json(status);
            } catch (error) {
                this.logger.error('Threat status error:', error);
                res.status(500).json({ error: 'Failed to get threat status' });
            }
        });
    }

    setupWebSocketHandlers() {
        this.io.on('connection', (socket) => {
            this.logger.info(`Client connected: ${socket.id}`);

            // Real-time fraud detection alerts
            socket.on('monitor-fraud', () => {
                this.fraudDetector.on('fraudDetected', (data) => {
                    socket.emit('fraud-alert', data);
                });
            });

            // Real-time network health monitoring
            socket.on('monitor-network', () => {
                this.selfHealing.on('networkIssue', (data) => {
                    socket.emit('network-alert', data);
                });
            });

            socket.on('disconnect', () => {
                this.logger.info(`Client disconnected: ${socket.id}`);
            });
        });
    }

    getPhoneServerStatus() {
        return {
            callRouter: this.callRouter.getStatus(),
            voiceProcessor: this.voiceProcessor.getStatus(),
            fraudDetector: this.fraudDetector.getStatus(),
            maintenanceMonitor: this.maintenanceMonitor.getStatus()
        };
    }

    getInternetGatewayStatus() {
        return {
            trafficManager: this.trafficManager.getStatus(),
            threatDetector: this.threatDetector.getStatus(),
            qosOptimizer: this.qosOptimizer.getStatus(),
            selfHealing: this.selfHealing.getStatus()
        };
    }

    async start() {
        const port = this.config.get('server.port', 3000);
        
        // Start all AI services
        await Promise.all([
            this.callRouter.initialize(),
            this.voiceProcessor.initialize(),
            this.fraudDetector.initialize(),
            this.maintenanceMonitor.initialize(),
            this.trafficManager.initialize(),
            this.threatDetector.initialize(),
            this.qosOptimizer.initialize(),
            this.selfHealing.initialize()
        ]);

        this.server.listen(port, () => {
            this.logger.info(`AI Phone Gateway Service started on port ${port}`);
            this.logger.info('All AI services initialized successfully');
        });
    }

    async stop() {
        this.logger.info('Shutting down AI Phone Gateway Service...');
        
        // Gracefully stop all services
        await Promise.all([
            this.callRouter.shutdown(),
            this.voiceProcessor.shutdown(),
            this.fraudDetector.shutdown(),
            this.maintenanceMonitor.shutdown(),
            this.trafficManager.shutdown(),
            this.threatDetector.shutdown(),
            this.qosOptimizer.shutdown(),
            this.selfHealing.shutdown()
        ]);

        this.server.close();
        this.logger.info('Service shutdown complete');
    }
}

// Start the service if this file is run directly
if (require.main === module) {
    const service = new AIPhoneGatewayService();
    
    // Graceful shutdown handling
    process.on('SIGINT', async () => {
        await service.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await service.stop();
        process.exit(0);
    });

    service.start().catch((error) => {
        console.error('Failed to start service:', error);
        process.exit(1);
    });
}

module.exports = AIPhoneGatewayService;