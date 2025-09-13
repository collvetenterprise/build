const express = require('express');
const EventEmitter = require('events');

class MCPAccessPoint extends EventEmitter {
    constructor() {
        super();
        this.router = express.Router();
        this.accessPoints = new Map();
        this.activeConnections = new Map();
        this.messageQueue = [];
        this.setupRoutes();
    }
    
    async initialize() {
        console.log('Initializing MCP Access Points...');
        await this.setupDefaultAccessPoints();
        this.startMessageProcessor();
        console.log('MCP Access Points initialized');
    }
    
    async setupDefaultAccessPoints() {
        const defaultAccessPoints = [
            {
                id: 'build-controller',
                type: 'build',
                endpoint: '/mcp/build',
                protocols: ['http', 'websocket'],
                authentication: 'token'
            },
            {
                id: 'gis-processor',
                type: 'gis',
                endpoint: '/mcp/gis',
                protocols: ['http', 'websocket'],
                authentication: 'certificate'
            },
            {
                id: 'agent-gateway',
                type: 'agent',
                endpoint: '/mcp/agents',
                protocols: ['websocket'],
                authentication: 'oauth'
            },
            {
                id: 'mgrs-service',
                type: 'mgrs',
                endpoint: '/mcp/mgrs',
                protocols: ['http'],
                authentication: 'token'
            }
        ];
        
        for (const ap of defaultAccessPoints) {
            this.accessPoints.set(ap.id, {
                ...ap,
                status: 'active',
                createdAt: new Date(),
                messageCount: 0,
                lastActivity: new Date()
            });
        }
    }
    
    startMessageProcessor() {
        setInterval(() => {
            this.processMessageQueue();
        }, 1000); // Process messages every second
    }
    
    processMessageQueue() {
        if (this.messageQueue.length === 0) return;
        
        const message = this.messageQueue.shift();
        this.routeMessage(message);
    }
    
    routeMessage(message) {
        const { targetAccessPoint, payload } = message;
        const accessPoint = this.accessPoints.get(targetAccessPoint);
        
        if (accessPoint) {
            accessPoint.messageCount++;
            accessPoint.lastActivity = new Date();
            
            // Emit message event for the specific access point
            this.emit('message', {
                accessPointId: targetAccessPoint,
                message: payload,
                timestamp: new Date()
            });
            
            console.log(`Message routed to access point: ${targetAccessPoint}`);
        } else {
            console.warn(`Unknown access point: ${targetAccessPoint}`);
        }
    }
    
    setupRoutes() {
        // List all access points
        this.router.get('/access-points', (req, res) => {
            const accessPointsList = Array.from(this.accessPoints.values());
            res.json({
                accessPoints: accessPointsList,
                totalCount: accessPointsList.length,
                activeCount: accessPointsList.filter(ap => ap.status === 'active').length
            });
        });
        
        // Get specific access point details
        this.router.get('/access-points/:id', (req, res) => {
            const { id } = req.params;
            const accessPoint = this.accessPoints.get(id);
            
            if (!accessPoint) {
                return res.status(404).json({
                    error: 'Access point not found',
                    id: id
                });
            }
            
            res.json(accessPoint);
        });
        
        // Create new access point
        this.router.post('/access-points', (req, res) => {
            const { id, type, endpoint, protocols, authentication } = req.body;
            
            if (!id || !type || !endpoint) {
                return res.status(400).json({
                    error: 'Missing required fields: id, type, endpoint'
                });
            }
            
            if (this.accessPoints.has(id)) {
                return res.status(409).json({
                    error: 'Access point already exists',
                    id: id
                });
            }
            
            const newAccessPoint = {
                id,
                type,
                endpoint,
                protocols: protocols || ['http'],
                authentication: authentication || 'none',
                status: 'active',
                createdAt: new Date(),
                messageCount: 0,
                lastActivity: new Date()
            };
            
            this.accessPoints.set(id, newAccessPoint);
            
            res.status(201).json({
                message: 'Access point created successfully',
                accessPoint: newAccessPoint
            });
        });
        
        // Send message to access point
        this.router.post('/message/:accessPointId', (req, res) => {
            const { accessPointId } = req.params;
            const { payload, priority = 'normal' } = req.body;
            
            const accessPoint = this.accessPoints.get(accessPointId);
            if (!accessPoint) {
                return res.status(404).json({
                    error: 'Access point not found',
                    id: accessPointId
                });
            }
            
            const message = {
                id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                targetAccessPoint: accessPointId,
                payload,
                priority,
                timestamp: new Date()
            };
            
            if (priority === 'high') {
                this.messageQueue.unshift(message); // High priority to front
            } else {
                this.messageQueue.push(message); // Normal priority to back
            }
            
            res.json({
                message: 'Message queued successfully',
                messageId: message.id,
                queueLength: this.messageQueue.length
            });
        });
        
        // Get message queue status
        this.router.get('/queue/status', (req, res) => {
            res.json({
                queueLength: this.messageQueue.length,
                messages: this.messageQueue.map(msg => ({
                    id: msg.id,
                    targetAccessPoint: msg.targetAccessPoint,
                    priority: msg.priority,
                    timestamp: msg.timestamp
                }))
            });
        });
        
        // Register connection to access point
        this.router.post('/connect/:accessPointId', (req, res) => {
            const { accessPointId } = req.params;
            const { clientId, protocol = 'http' } = req.body;
            
            const accessPoint = this.accessPoints.get(accessPointId);
            if (!accessPoint) {
                return res.status(404).json({
                    error: 'Access point not found',
                    id: accessPointId
                });
            }
            
            if (!accessPoint.protocols.includes(protocol)) {
                return res.status(400).json({
                    error: 'Protocol not supported',
                    supportedProtocols: accessPoint.protocols
                });
            }
            
            const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const connection = {
                connectionId,
                clientId: clientId || connectionId,
                accessPointId,
                protocol,
                connectedAt: new Date(),
                lastPing: new Date()
            };
            
            this.activeConnections.set(connectionId, connection);
            
            res.json({
                message: 'Connected to access point successfully',
                connectionId,
                accessPoint: accessPoint.id
            });
        });
        
        // Disconnect from access point
        this.router.delete('/connect/:connectionId', (req, res) => {
            const { connectionId } = req.params;
            
            if (this.activeConnections.has(connectionId)) {
                this.activeConnections.delete(connectionId);
                res.json({
                    message: 'Disconnected successfully',
                    connectionId
                });
            } else {
                res.status(404).json({
                    error: 'Connection not found',
                    connectionId
                });
            }
        });
        
        // Ping access point
        this.router.post('/ping/:accessPointId', (req, res) => {
            const { accessPointId } = req.params;
            const accessPoint = this.accessPoints.get(accessPointId);
            
            if (!accessPoint) {
                return res.status(404).json({
                    error: 'Access point not found',
                    id: accessPointId
                });
            }
            
            const responseTime = Math.random() * 50 + 10; // Simulate 10-60ms response time
            
            setTimeout(() => {
                res.json({
                    accessPointId,
                    status: accessPoint.status,
                    responseTime: Math.round(responseTime),
                    timestamp: new Date()
                });
            }, responseTime);
        });
    }
    
    getStatus() {
        return {
            initialized: true,
            accessPointCount: this.accessPoints.size,
            activeConnections: this.activeConnections.size,
            queueLength: this.messageQueue.length,
            totalMessages: Array.from(this.accessPoints.values())
                .reduce((sum, ap) => sum + ap.messageCount, 0)
        };
    }
    
    getRouter() {
        return this.router;
    }
}

module.exports = MCPAccessPoint;