const express = require('express');

class AgentPortal {
    constructor() {
        this.router = express.Router();
        this.agents = new Map();
        this.traces = new Map();
        this.sessions = new Map();
        this.references = new Map();
        this.setupRoutes();
    }
    
    async initialize() {
        console.log('Initializing Agent Portal...');
        await this.setupDefaultAgents();
        this.startTraceProcessor();
        console.log('Agent Portal initialized');
    }
    
    async setupDefaultAgents() {
        const defaultAgents = [
            {
                id: 'agent-001',
                name: 'Build Coordinator',
                type: 'build',
                capabilities: ['build-management', 'deployment', 'artifact-handling'],
                status: 'active',
                endpoint: '/agents/build-coordinator',
                version: '1.0.0'
            },
            {
                id: 'agent-002',
                name: 'GIS Monitor',
                type: 'gis',
                capabilities: ['signal-processing', 'coordinate-tracking', 'range-analysis'],
                status: 'active',
                endpoint: '/agents/gis-monitor',
                version: '1.2.0'
            },
            {
                id: 'agent-003',
                name: 'MCP Gateway',
                type: 'mcp',
                capabilities: ['message-routing', 'protocol-translation', 'access-control'],
                status: 'active',
                endpoint: '/agents/mcp-gateway',
                version: '2.1.0'
            },
            {
                id: 'agent-004',
                name: 'MGRS Tracker',
                type: 'mgrs',
                capabilities: ['coordinate-conversion', 'location-services', 'ping-monitoring'],
                status: 'standby',
                endpoint: '/agents/mgrs-tracker',
                version: '1.5.0'
            }
        ];
        
        for (const agent of defaultAgents) {
            this.agents.set(agent.id, {
                ...agent,
                createdAt: new Date(),
                lastActivity: new Date(),
                sessionCount: 0,
                traceCount: 0,
                metrics: {
                    totalRequests: 0,
                    successfulRequests: 0,
                    averageResponseTime: 0,
                    errorCount: 0
                }
            });
        }
    }
    
    startTraceProcessor() {
        setInterval(() => {
            this.processTraces();
            this.updateAgentMetrics();
        }, 10000); // Process every 10 seconds
    }
    
    processTraces() {
        const currentTime = new Date();
        const cutoffTime = new Date(currentTime.getTime() - (24 * 60 * 60 * 1000)); // 24 hours ago
        
        // Clean up old traces
        for (const [traceId, trace] of this.traces) {
            if (trace.timestamp < cutoffTime) {
                this.traces.delete(traceId);
            }
        }
        
        // Update trace references
        this.updateTraceReferences();
    }
    
    updateTraceReferences() {
        const tracesByAgent = new Map();
        
        for (const [traceId, trace] of this.traces) {
            if (!tracesByAgent.has(trace.agentId)) {
                tracesByAgent.set(trace.agentId, []);
            }
            tracesByAgent.get(trace.agentId).push(traceId);
        }
        
        // Update reference counts
        for (const [agentId, traceIds] of tracesByAgent) {
            this.references.set(agentId, {
                agentId,
                activeTraces: traceIds.length,
                lastUpdate: new Date(),
                traceReferences: traceIds.slice(-100) // Keep last 100 traces
            });
        }
    }
    
    updateAgentMetrics() {
        for (const [agentId, agent] of this.agents) {
            // Simulate some activity for demonstration
            if (agent.status === 'active') {
                const randomActivity = Math.random();
                if (randomActivity > 0.7) {
                    this.recordAgentActivity(agentId, 'request', Math.random() > 0.9 ? 'error' : 'success');
                }
            }
        }
    }
    
    recordAgentActivity(agentId, activityType, result = 'success') {
        const agent = this.agents.get(agentId);
        if (!agent) return;
        
        agent.lastActivity = new Date();
        agent.metrics.totalRequests++;
        
        if (result === 'success') {
            agent.metrics.successfulRequests++;
        } else {
            agent.metrics.errorCount++;
        }
        
        // Update average response time (simulated)
        const responseTime = Math.random() * 1000 + 50; // 50-1050ms
        agent.metrics.averageResponseTime = 
            (agent.metrics.averageResponseTime * (agent.metrics.totalRequests - 1) + responseTime) / 
            agent.metrics.totalRequests;
        
        // Create trace for this activity
        this.createTrace(agentId, activityType, {
            result,
            responseTime: Math.round(responseTime),
            timestamp: new Date()
        });
    }
    
    createTrace(agentId, operation, data) {
        const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const trace = {
            traceId,
            agentId,
            operation,
            data,
            timestamp: new Date(),
            references: []
        };
        
        this.traces.set(traceId, trace);
        
        // Update agent trace count
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.traceCount++;
        }
        
        return traceId;
    }
    
    setupRoutes() {
        // Get all agents
        this.router.get('/agents', (req, res) => {
            const agentsList = Array.from(this.agents.values());
            res.json({
                agents: agentsList,
                totalCount: agentsList.length,
                activeCount: agentsList.filter(agent => agent.status === 'active').length,
                types: [...new Set(agentsList.map(agent => agent.type))]
            });
        });
        
        // Get specific agent
        this.router.get('/agents/:id', (req, res) => {
            const { id } = req.params;
            const agent = this.agents.get(id);
            
            if (!agent) {
                return res.status(404).json({
                    error: 'Agent not found',
                    id: id
                });
            }
            
            // Include recent traces
            const recentTraces = Array.from(this.traces.values())
                .filter(trace => trace.agentId === id)
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 10);
            
            res.json({
                ...agent,
                recentTraces,
                references: this.references.get(id)
            });
        });
        
        // Register new agent
        this.router.post('/agents', (req, res) => {
            const { id, name, type, capabilities, endpoint, version } = req.body;
            
            if (!id || !name || !type) {
                return res.status(400).json({
                    error: 'Missing required fields: id, name, type'
                });
            }
            
            if (this.agents.has(id)) {
                return res.status(409).json({
                    error: 'Agent already exists',
                    id: id
                });
            }
            
            const newAgent = {
                id,
                name,
                type,
                capabilities: capabilities || [],
                endpoint: endpoint || `/agents/${id}`,
                version: version || '1.0.0',
                status: 'active',
                createdAt: new Date(),
                lastActivity: new Date(),
                sessionCount: 0,
                traceCount: 0,
                metrics: {
                    totalRequests: 0,
                    successfulRequests: 0,
                    averageResponseTime: 0,
                    errorCount: 0
                }
            };
            
            this.agents.set(id, newAgent);
            
            res.status(201).json({
                message: 'Agent registered successfully',
                agent: newAgent
            });
        });
        
        // Update agent status
        this.router.put('/agents/:id/status', (req, res) => {
            const { id } = req.params;
            const { status } = req.body;
            
            const agent = this.agents.get(id);
            if (!agent) {
                return res.status(404).json({
                    error: 'Agent not found',
                    id: id
                });
            }
            
            if (!['active', 'inactive', 'standby', 'maintenance'].includes(status)) {
                return res.status(400).json({
                    error: 'Invalid status',
                    validStatuses: ['active', 'inactive', 'standby', 'maintenance']
                });
            }
            
            agent.status = status;
            agent.lastActivity = new Date();
            
            // Create trace for status change
            this.createTrace(id, 'status_change', { newStatus: status });
            
            res.json({
                message: 'Agent status updated successfully',
                agentId: id,
                status: status
            });
        });
        
        // Create session with agent
        this.router.post('/agents/:id/sessions', (req, res) => {
            const { id } = req.params;
            const { clientId, sessionType = 'default' } = req.body;
            
            const agent = this.agents.get(id);
            if (!agent) {
                return res.status(404).json({
                    error: 'Agent not found',
                    id: id
                });
            }
            
            if (agent.status !== 'active') {
                return res.status(503).json({
                    error: 'Agent not available',
                    status: agent.status
                });
            }
            
            const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const session = {
                sessionId,
                agentId: id,
                clientId: clientId || 'anonymous',
                sessionType,
                createdAt: new Date(),
                lastActivity: new Date(),
                requestCount: 0,
                status: 'active'
            };
            
            this.sessions.set(sessionId, session);
            agent.sessionCount++;
            
            // Create trace for session creation
            this.createTrace(id, 'session_created', { sessionId, clientId });
            
            res.status(201).json({
                message: 'Session created successfully',
                session: session
            });
        });
        
        // Get agent sessions
        this.router.get('/agents/:id/sessions', (req, res) => {
            const { id } = req.params;
            
            const agent = this.agents.get(id);
            if (!agent) {
                return res.status(404).json({
                    error: 'Agent not found',
                    id: id
                });
            }
            
            const agentSessions = Array.from(this.sessions.values())
                .filter(session => session.agentId === id);
            
            res.json({
                agentId: id,
                sessions: agentSessions,
                activeSessionCount: agentSessions.filter(s => s.status === 'active').length,
                totalSessionCount: agentSessions.length
            });
        });
        
        // Get traces for agent
        this.router.get('/agents/:id/traces', (req, res) => {
            const { id } = req.params;
            const { limit = 50, operation } = req.query;
            
            const agent = this.agents.get(id);
            if (!agent) {
                return res.status(404).json({
                    error: 'Agent not found',
                    id: id
                });
            }
            
            let agentTraces = Array.from(this.traces.values())
                .filter(trace => trace.agentId === id);
            
            if (operation) {
                agentTraces = agentTraces.filter(trace => trace.operation === operation);
            }
            
            agentTraces = agentTraces
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, parseInt(limit));
            
            res.json({
                agentId: id,
                traces: agentTraces,
                totalTraceCount: agent.traceCount,
                operations: [...new Set(Array.from(this.traces.values())
                    .filter(trace => trace.agentId === id)
                    .map(trace => trace.operation))]
            });
        });
        
        // Get specific trace
        this.router.get('/traces/:traceId', (req, res) => {
            const { traceId } = req.params;
            const trace = this.traces.get(traceId);
            
            if (!trace) {
                return res.status(404).json({
                    error: 'Trace not found',
                    traceId: traceId
                });
            }
            
            // Include related traces (traces that reference this one)
            const relatedTraces = Array.from(this.traces.values())
                .filter(t => t.references.includes(traceId));
            
            res.json({
                ...trace,
                relatedTraces: relatedTraces.map(t => ({
                    traceId: t.traceId,
                    operation: t.operation,
                    timestamp: t.timestamp
                }))
            });
        });
        
        // Create trace reference
        this.router.post('/traces/:traceId/references', (req, res) => {
            const { traceId } = req.params;
            const { referencedTraceId, referenceType = 'related' } = req.body;
            
            const trace = this.traces.get(traceId);
            const referencedTrace = this.traces.get(referencedTraceId);
            
            if (!trace || !referencedTrace) {
                return res.status(404).json({
                    error: 'One or both traces not found',
                    traceId,
                    referencedTraceId
                });
            }
            
            if (!trace.references.includes(referencedTraceId)) {
                trace.references.push(referencedTraceId);
            }
            
            res.json({
                message: 'Trace reference created successfully',
                traceId,
                referencedTraceId,
                referenceType
            });
        });
        
        // Get portal statistics
        this.router.get('/statistics', (req, res) => {
            const stats = {
                totalAgents: this.agents.size,
                activeAgents: Array.from(this.agents.values()).filter(a => a.status === 'active').length,
                totalSessions: this.sessions.size,
                activeSessions: Array.from(this.sessions.values()).filter(s => s.status === 'active').length,
                totalTraces: this.traces.size,
                agentTypes: [...new Set(Array.from(this.agents.values()).map(a => a.type))],
                averageResponseTime: this.calculateAverageResponseTime(),
                successRate: this.calculateSuccessRate()
            };
            
            res.json(stats);
        });
    }
    
    calculateAverageResponseTime() {
        const agents = Array.from(this.agents.values());
        const totalTime = agents.reduce((sum, agent) => sum + agent.metrics.averageResponseTime, 0);
        return agents.length > 0 ? Math.round(totalTime / agents.length) : 0;
    }
    
    calculateSuccessRate() {
        const agents = Array.from(this.agents.values());
        const totalRequests = agents.reduce((sum, agent) => sum + agent.metrics.totalRequests, 0);
        const successfulRequests = agents.reduce((sum, agent) => sum + agent.metrics.successfulRequests, 0);
        return totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 100;
    }
    
    getStatus() {
        return {
            initialized: true,
            agentCount: this.agents.size,
            activeAgents: Array.from(this.agents.values()).filter(a => a.status === 'active').length,
            activeSessions: Array.from(this.sessions.values()).filter(s => s.status === 'active').length,
            totalTraces: this.traces.size,
            successRate: this.calculateSuccessRate()
        };
    }
    
    getRouter() {
        return this.router;
    }
}

module.exports = AgentPortal;