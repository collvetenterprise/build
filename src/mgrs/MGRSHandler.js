const express = require('express');

class MGRSHandler {
    constructor() {
        this.router = express.Router();
        this.mgrsGrid = new Map();
        this.pingTargets = new Map();
        this.pingHistory = new Map();
        this.gridZones = this.initializeGridZones();
        this.setupRoutes();
    }
    
    async initialize() {
        console.log('Initializing MGRS Handler...');
        await this.setupDefaultGrid();
        this.startPingMonitoring();
        console.log('MGRS Handler initialized');
    }
    
    initializeGridZones() {
        // Initialize MGRS grid zones (simplified)
        const zones = new Map();
        
        // UTM zones 1-60
        for (let zone = 1; zone <= 60; zone++) {
            // Latitude bands C-X (excluding I and O)
            const bands = 'CDEFGHJKLMNPQRSTUVWX';
            for (const band of bands) {
                const zoneId = `${zone}${band}`;
                zones.set(zoneId, {
                    zone: zone,
                    band: band,
                    hemisphere: band < 'N' ? 'south' : 'north',
                    centralMeridian: (zone - 1) * 6 - 180 + 3,
                    active: false,
                    lastPing: null
                });
            }
        }
        
        return zones;
    }
    
    async setupDefaultGrid() {
        // Setup default MGRS grid points for monitoring
        const defaultGridPoints = [
            {
                mgrs: '13SDD1234567890',
                coordinates: { latitude: 39.7392, longitude: -104.9903 },
                name: 'Denver Metro',
                type: 'primary',
                status: 'active'
            },
            {
                mgrs: '12SWD1234567890',
                coordinates: { latitude: 34.0522, longitude: -118.2437 },
                name: 'Los Angeles',
                type: 'secondary',
                status: 'active'
            },
            {
                mgrs: '18TWL1234567890',
                coordinates: { latitude: 40.7128, longitude: -74.0060 },
                name: 'New York',
                type: 'primary',
                status: 'active'
            },
            {
                mgrs: '16SCJ1234567890',
                coordinates: { latitude: 41.8781, longitude: -87.6298 },
                name: 'Chicago',
                type: 'secondary',
                status: 'standby'
            }
        ];
        
        for (const point of defaultGridPoints) {
            this.mgrsGrid.set(point.mgrs, {
                ...point,
                createdAt: new Date(),
                lastUpdate: new Date(),
                pingCount: 0,
                averageLatency: 0
            });
            
            // Add as ping target
            this.pingTargets.set(point.mgrs, {
                mgrs: point.mgrs,
                name: point.name,
                endpoint: this.generateEndpoint(point.coordinates),
                pingInterval: point.type === 'primary' ? 30000 : 60000, // 30s or 60s
                lastPing: null,
                status: 'active',
                consecutiveFailures: 0
            });
        }
    }
    
    generateEndpoint(coordinates) {
        // Generate a mock endpoint based on coordinates
        const hash = Math.abs(coordinates.latitude + coordinates.longitude * 1000) % 255;
        return `192.168.1.${Math.floor(hash) + 1}`;
    }
    
    startPingMonitoring() {
        // Start ping monitoring for all active targets
        setInterval(() => {
            this.performPingCycle();
        }, 10000); // Check every 10 seconds
        
        // Cleanup old ping history
        setInterval(() => {
            this.cleanupPingHistory();
        }, 300000); // Every 5 minutes
    }
    
    async performPingCycle() {
        const currentTime = new Date();
        
        for (const [mgrs, target] of this.pingTargets) {
            if (target.status !== 'active') continue;
            
            const shouldPing = !target.lastPing || 
                (currentTime - target.lastPing) >= target.pingInterval;
            
            if (shouldPing) {
                await this.pingTarget(mgrs);
            }
        }
    }
    
    async pingTarget(mgrs) {
        const target = this.pingTargets.get(mgrs);
        const gridPoint = this.mgrsGrid.get(mgrs);
        
        if (!target || !gridPoint) return;
        
        try {
            // Simulate ping operation
            const latency = await this.simulatePing(target.endpoint);
            const pingResult = {
                mgrs,
                endpoint: target.endpoint,
                latency,
                status: 'success',
                timestamp: new Date(),
                packetLoss: 0
            };
            
            // Update target
            target.lastPing = new Date();
            target.consecutiveFailures = 0;
            
            // Update grid point
            gridPoint.lastUpdate = new Date();
            gridPoint.pingCount++;
            gridPoint.averageLatency = 
                (gridPoint.averageLatency * (gridPoint.pingCount - 1) + latency) / gridPoint.pingCount;
            
            // Store ping history
            this.storePingHistory(mgrs, pingResult);
            
            console.log(`Ping successful: ${mgrs} (${latency}ms)`);
            
        } catch (error) {
            const pingResult = {
                mgrs,
                endpoint: target.endpoint,
                latency: null,
                status: 'failed',
                timestamp: new Date(),
                error: error.message,
                packetLoss: 100
            };
            
            target.lastPing = new Date();
            target.consecutiveFailures++;
            
            // Mark as inactive after 3 consecutive failures
            if (target.consecutiveFailures >= 3) {
                target.status = 'inactive';
                gridPoint.status = 'inactive';
            }
            
            this.storePingHistory(mgrs, pingResult);
            
            console.warn(`Ping failed: ${mgrs} - ${error.message}`);
        }
    }
    
    async simulatePing(_endpoint) {
        // Simulate network ping with random latency
        const baseLatency = 20; // Base 20ms
        const jitter = Math.random() * 100; // 0-100ms jitter
        const latency = Math.round(baseLatency + jitter);
        
        // Simulate occasional failures (5% chance)
        if (Math.random() < 0.05) {
            throw new Error('Network timeout');
        }
        
        // Simulate ping delay
        await new Promise(resolve => setTimeout(resolve, Math.min(latency, 100)));
        
        return latency;
    }
    
    storePingHistory(mgrs, pingResult) {
        if (!this.pingHistory.has(mgrs)) {
            this.pingHistory.set(mgrs, []);
        }
        
        const history = this.pingHistory.get(mgrs);
        history.push(pingResult);
        
        // Keep only last 100 ping results per target
        if (history.length > 100) {
            history.shift();
        }
    }
    
    cleanupPingHistory() {
        const cutoffTime = new Date(Date.now() - (24 * 60 * 60 * 1000)); // 24 hours ago
        
        for (const [mgrs, history] of this.pingHistory) {
            const filteredHistory = history.filter(ping => ping.timestamp > cutoffTime);
            this.pingHistory.set(mgrs, filteredHistory);
        }
    }
    
    setupRoutes() {
        // Convert coordinates to MGRS
        this.router.post('/convert/to-mgrs', (req, res) => {
            const { latitude, longitude, precision = 5 } = req.body;
            
            if (!latitude || !longitude) {
                return res.status(400).json({
                    error: 'Missing required coordinates: latitude, longitude'
                });
            }
            
            try {
                const mgrs = this.convertToMGRS(latitude, longitude, precision);
                const zone = this.getUTMZone(longitude);
                const band = this.getLatitudeBand(latitude);
                
                res.json({
                    coordinates: { latitude, longitude },
                    mgrs,
                    zone,
                    band,
                    precision
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Conversion failed',
                    message: error.message
                });
            }
        });
        
        // Convert MGRS to coordinates
        this.router.post('/convert/from-mgrs', (req, res) => {
            const { mgrs } = req.body;
            
            if (!mgrs) {
                return res.status(400).json({
                    error: 'Missing required field: mgrs'
                });
            }
            
            try {
                const coordinates = this.convertFromMGRS(mgrs);
                const zone = this.getUTMZone(coordinates.longitude);
                const band = this.getLatitudeBand(coordinates.latitude);
                
                res.json({
                    mgrs,
                    coordinates,
                    zone,
                    band
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Conversion failed',
                    message: error.message
                });
            }
        });
        
        // Get grid points
        this.router.get('/grid', (req, res) => {
            const { status, type } = req.query;
            
            let gridPoints = Array.from(this.mgrsGrid.values());
            
            if (status) {
                gridPoints = gridPoints.filter(point => point.status === status);
            }
            
            if (type) {
                gridPoints = gridPoints.filter(point => point.type === type);
            }
            
            res.json({
                gridPoints,
                totalCount: gridPoints.length,
                activeCount: gridPoints.filter(p => p.status === 'active').length,
                primaryCount: gridPoints.filter(p => p.type === 'primary').length
            });
        });
        
        // Get specific grid point
        this.router.get('/grid/:mgrs', (req, res) => {
            const { mgrs } = req.params;
            const gridPoint = this.mgrsGrid.get(mgrs);
            
            if (!gridPoint) {
                return res.status(404).json({
                    error: 'Grid point not found',
                    mgrs: mgrs
                });
            }
            
            // Include ping target info and recent ping history
            const pingTarget = this.pingTargets.get(mgrs);
            const pingHistory = this.pingHistory.get(mgrs) || [];
            
            res.json({
                ...gridPoint,
                pingTarget,
                recentPings: pingHistory.slice(-10),
                totalPings: pingHistory.length
            });
        });
        
        // Add new grid point
        this.router.post('/grid', (req, res) => {
            const { mgrs, coordinates, name, type = 'secondary' } = req.body;
            
            if (!mgrs || !coordinates || !name) {
                return res.status(400).json({
                    error: 'Missing required fields: mgrs, coordinates, name'
                });
            }
            
            if (this.mgrsGrid.has(mgrs)) {
                return res.status(409).json({
                    error: 'Grid point already exists',
                    mgrs: mgrs
                });
            }
            
            const newGridPoint = {
                mgrs,
                coordinates,
                name,
                type,
                status: 'active',
                createdAt: new Date(),
                lastUpdate: new Date(),
                pingCount: 0,
                averageLatency: 0
            };
            
            this.mgrsGrid.set(mgrs, newGridPoint);
            
            // Add as ping target
            this.pingTargets.set(mgrs, {
                mgrs,
                name,
                endpoint: this.generateEndpoint(coordinates),
                pingInterval: type === 'primary' ? 30000 : 60000,
                lastPing: null,
                status: 'active',
                consecutiveFailures: 0
            });
            
            res.status(201).json({
                message: 'Grid point created successfully',
                gridPoint: newGridPoint
            });
        });
        
        // Ping specific target
        this.router.post('/ping/:mgrs', async (req, res) => {
            const { mgrs } = req.params;
            const gridPoint = this.mgrsGrid.get(mgrs);
            
            if (!gridPoint) {
                return res.status(404).json({
                    error: 'Grid point not found',
                    mgrs: mgrs
                });
            }
            
            try {
                await this.pingTarget(mgrs);
                const latestPing = this.pingHistory.get(mgrs)?.slice(-1)[0];
                
                res.json({
                    message: 'Ping completed',
                    mgrs,
                    result: latestPing
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Ping failed',
                    mgrs,
                    message: error.message
                });
            }
        });
        
        // Get ping statistics
        this.router.get('/ping/statistics', (req, res) => {
            const { mgrs } = req.query;
            
            if (mgrs) {
                // Statistics for specific grid point
                const history = this.pingHistory.get(mgrs) || [];
                const successfulPings = history.filter(p => p.status === 'success');
                const failedPings = history.filter(p => p.status === 'failed');
                
                const stats = {
                    mgrs,
                    totalPings: history.length,
                    successfulPings: successfulPings.length,
                    failedPings: failedPings.length,
                    successRate: history.length > 0 ? 
                        Math.round((successfulPings.length / history.length) * 100) : 0,
                    averageLatency: successfulPings.length > 0 ?
                        Math.round(successfulPings.reduce((sum, p) => sum + p.latency, 0) / successfulPings.length) : 0,
                    lastPing: history.slice(-1)[0] || null
                };
                
                res.json(stats);
            } else {
                // Global statistics
                const allTargets = Array.from(this.pingTargets.values());
                const activeTargets = allTargets.filter(t => t.status === 'active');
                const totalPings = Array.from(this.pingHistory.values())
                    .reduce((sum, history) => sum + history.length, 0);
                
                const globalStats = {
                    totalTargets: allTargets.length,
                    activeTargets: activeTargets.length,
                    totalPings,
                    averageLatency: this.calculateGlobalAverageLatency(),
                    globalSuccessRate: this.calculateGlobalSuccessRate()
                };
                
                res.json(globalStats);
            }
        });
        
        // Get ping history
        this.router.get('/ping/history/:mgrs', (req, res) => {
            const { mgrs } = req.params;
            const { limit = 50 } = req.query;
            
            const history = this.pingHistory.get(mgrs) || [];
            const limitedHistory = history.slice(-parseInt(limit));
            
            res.json({
                mgrs,
                history: limitedHistory,
                totalCount: history.length
            });
        });
        
        // Calculate distance between MGRS points
        this.router.post('/calculate-distance', (req, res) => {
            const { fromMGRS, toMGRS } = req.body;
            
            try {
                const fromCoords = this.convertFromMGRS(fromMGRS);
                const toCoords = this.convertFromMGRS(toMGRS);
                
                const distance = this.calculateDistance(fromCoords, toCoords);
                const bearing = this.calculateBearing(fromCoords, toCoords);
                
                res.json({
                    fromMGRS,
                    toMGRS,
                    fromCoordinates: fromCoords,
                    toCoordinates: toCoords,
                    distance: Math.round(distance),
                    bearing: Math.round(bearing),
                    unit: 'meters'
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Distance calculation failed',
                    message: error.message
                });
            }
        });
    }
    
    convertToMGRS(latitude, longitude, precision = 5) {
        // Simplified MGRS conversion
        const zone = this.getUTMZone(longitude);
        const band = this.getLatitudeBand(latitude);
        
        // For demonstration, create a mock MGRS coordinate
        const square = 'DD'; // Simplified
        const easting = Math.floor((longitude + 180) % 6 * 100000).toString().padStart(precision, '0');
        const northing = Math.floor((latitude + 90) * 111000 % 100000).toString().padStart(precision, '0');
        
        return `${zone}${band}${square}${easting}${northing}`;
    }
    
    convertFromMGRS(mgrs) {
        // Simplified MGRS to coordinates conversion
        const zone = parseInt(mgrs.substring(0, 2));
        const band = mgrs.charAt(2);
        const coords = mgrs.substring(5);
        
        const precision = coords.length / 2;
        const easting = parseInt(coords.substring(0, precision));
        const northing = parseInt(coords.substring(precision));
        
        // Approximate conversion for demonstration
        const longitude = (zone - 1) * 6 - 180 + 3 + (easting / Math.pow(10, precision)) * 6;
        const latitude = (band.charCodeAt(0) - 67) * 8 - 80 + (northing / Math.pow(10, precision)) * 8;
        
        return { latitude, longitude };
    }
    
    getUTMZone(longitude) {
        return Math.floor((longitude + 180) / 6) + 1;
    }
    
    getLatitudeBand(latitude) {
        const bands = 'CDEFGHJKLMNPQRSTUVWX';
        const index = Math.floor((latitude + 80) / 8);
        return bands[Math.max(0, Math.min(index, bands.length - 1))];
    }
    
    calculateDistance(coord1, coord2) {
        const R = 6371000; // Earth's radius in meters
        const lat1 = coord1.latitude * Math.PI / 180;
        const lat2 = coord2.latitude * Math.PI / 180;
        const deltaLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
        const deltaLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
        
        const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c;
    }
    
    calculateBearing(coord1, coord2) {
        const lat1 = coord1.latitude * Math.PI / 180;
        const lat2 = coord2.latitude * Math.PI / 180;
        const deltaLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
        
        const x = Math.sin(deltaLon) * Math.cos(lat2);
        const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
        
        const bearing = Math.atan2(x, y) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }
    
    calculateGlobalAverageLatency() {
        const gridPoints = Array.from(this.mgrsGrid.values());
        const totalLatency = gridPoints.reduce((sum, point) => sum + point.averageLatency, 0);
        const pointsWithLatency = gridPoints.filter(point => point.averageLatency > 0);
        return pointsWithLatency.length > 0 ? Math.round(totalLatency / pointsWithLatency.length) : 0;
    }
    
    calculateGlobalSuccessRate() {
        let totalPings = 0;
        let successfulPings = 0;
        
        for (const history of this.pingHistory.values()) {
            totalPings += history.length;
            successfulPings += history.filter(p => p.status === 'success').length;
        }
        
        return totalPings > 0 ? Math.round((successfulPings / totalPings) * 100) : 100;
    }
    
    getStatus() {
        return {
            initialized: true,
            gridPointCount: this.mgrsGrid.size,
            activeGridPoints: Array.from(this.mgrsGrid.values()).filter(p => p.status === 'active').length,
            pingTargetCount: this.pingTargets.size,
            activePingTargets: Array.from(this.pingTargets.values()).filter(t => t.status === 'active').length,
            totalPings: Array.from(this.pingHistory.values()).reduce((sum, h) => sum + h.length, 0),
            globalSuccessRate: this.calculateGlobalSuccessRate()
        };
    }
    
    getRouter() {
        return this.router;
    }
}

module.exports = MGRSHandler;