const express = require('express');

class GISProcessor {
    constructor() {
        this.router = express.Router();
        this.focusPoints = new Map();
        this.signalData = new Map();
        this.processingQueue = [];
        this.coordinateSystems = ['WGS84', 'UTM', 'MGRS'];
        this.setupRoutes();
    }
    
    async initialize() {
        console.log('Initializing GIS Processor...');
        await this.setupDefaultFocusPoints();
        this.startSignalProcessor();
        console.log('GIS Processor initialized');
    }
    
    async setupDefaultFocusPoints() {
        const defaultFocusPoints = [
            {
                id: 'fp-001',
                name: 'Primary Control Station',
                coordinates: {
                    latitude: 39.7392,
                    longitude: -104.9903,
                    elevation: 1609
                },
                mgrs: '13SDD1234567890',
                signalType: 'control',
                frequency: 2.4,
                range: 10000,
                status: 'active'
            },
            {
                id: 'fp-002',
                name: 'Secondary Relay Point',
                coordinates: {
                    latitude: 40.0150,
                    longitude: -105.2705,
                    elevation: 1655
                },
                mgrs: '13SDD2345678901',
                signalType: 'relay',
                frequency: 5.8,
                range: 15000,
                status: 'active'
            },
            {
                id: 'fp-003',
                name: 'Monitoring Station Alpha',
                coordinates: {
                    latitude: 39.5501,
                    longitude: -105.7821,
                    elevation: 2073
                },
                mgrs: '13SDD3456789012',
                signalType: 'monitor',
                frequency: 1.2,
                range: 5000,
                status: 'standby'
            }
        ];
        
        for (const fp of defaultFocusPoints) {
            this.focusPoints.set(fp.id, {
                ...fp,
                createdAt: new Date(),
                lastUpdate: new Date(),
                signalHistory: []
            });
        }
    }
    
    startSignalProcessor() {
        setInterval(() => {
            this.processSignalQueue();
            this.generateSignalData();
        }, 5000); // Process every 5 seconds
    }
    
    processSignalQueue() {
        while (this.processingQueue.length > 0) {
            const task = this.processingQueue.shift();
            this.executeSignalProcessing(task);
        }
    }
    
    executeSignalProcessing(task) {
        const { type, focusPointId, data } = task;
        const focusPoint = this.focusPoints.get(focusPointId);
        
        if (!focusPoint) {
            console.warn(`Focus point not found: ${focusPointId}`);
            return;
        }
        
        switch (type) {
        case 'signal_analysis':
            this.analyzeSignal(focusPoint, data);
            break;
        case 'coordinate_transform':
            this.transformCoordinates(focusPoint, data);
            break;
        case 'range_calculation':
            this.calculateRange(focusPoint, data);
            break;
        default:
            console.warn(`Unknown processing type: ${type}`);
        }
    }
    
    analyzeSignal(focusPoint, _data) {
        const analysis = {
            timestamp: new Date(),
            signalStrength: Math.random() * 100,
            noiseLevel: Math.random() * 10,
            frequency: focusPoint.frequency + (Math.random() - 0.5) * 0.1,
            bearing: Math.random() * 360,
            quality: Math.random() > 0.8 ? 'good' : Math.random() > 0.5 ? 'fair' : 'poor'
        };
        
        focusPoint.signalHistory.push(analysis);
        if (focusPoint.signalHistory.length > 100) {
            focusPoint.signalHistory.shift(); // Keep only last 100 readings
        }
        
        this.signalData.set(`${focusPoint.id}-latest`, analysis);
    }
    
    transformCoordinates(focusPoint, _data) {
        const { fromSystem, toSystem } = _data;
        
        // Simplified coordinate transformation
        let transformed = { ...focusPoint.coordinates };
        
        if (fromSystem === 'WGS84' && toSystem === 'UTM') {
            // Simple approximation for demonstration
            transformed.zone = '13S';
            transformed.easting = 500000 + (focusPoint.coordinates.longitude + 105) * 100000;
            transformed.northing = 4400000 + (focusPoint.coordinates.latitude - 39) * 110000;
        }
        
        return transformed;
    }
    
    calculateRange(focusPoint, data) {
        const { targetCoordinates } = data;
        
        // Calculate distance using Haversine formula
        const R = 6371000; // Earth's radius in meters
        const lat1 = focusPoint.coordinates.latitude * Math.PI / 180;
        const lat2 = targetCoordinates.latitude * Math.PI / 180;
        const deltaLat = (targetCoordinates.latitude - focusPoint.coordinates.latitude) * Math.PI / 180;
        const deltaLon = (targetCoordinates.longitude - focusPoint.coordinates.longitude) * Math.PI / 180;
        
        const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        return {
            distance: Math.round(distance),
            bearing: this.calculateBearing(focusPoint.coordinates, targetCoordinates),
            inRange: distance <= focusPoint.range
        };
    }
    
    calculateBearing(from, to) {
        const lat1 = from.latitude * Math.PI / 180;
        const lat2 = to.latitude * Math.PI / 180;
        const deltaLon = (to.longitude - from.longitude) * Math.PI / 180;
        
        const x = Math.sin(deltaLon) * Math.cos(lat2);
        const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
        
        const bearing = Math.atan2(x, y) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }
    
    generateSignalData() {
        // Generate synthetic signal data for all active focus points
        for (const [id, focusPoint] of this.focusPoints) {
            if (focusPoint.status === 'active') {
                this.processingQueue.push({
                    type: 'signal_analysis',
                    focusPointId: id,
                    data: {}
                });
            }
        }
    }
    
    setupRoutes() {
        // Get all focus points
        this.router.get('/focus-points', (req, res) => {
            const focusPointsList = Array.from(this.focusPoints.values());
            res.json({
                focusPoints: focusPointsList,
                totalCount: focusPointsList.length,
                activeCount: focusPointsList.filter(fp => fp.status === 'active').length
            });
        });
        
        // Get specific focus point
        this.router.get('/focus-points/:id', (req, res) => {
            const { id } = req.params;
            const focusPoint = this.focusPoints.get(id);
            
            if (!focusPoint) {
                return res.status(404).json({
                    error: 'Focus point not found',
                    id: id
                });
            }
            
            res.json(focusPoint);
        });
        
        // Create new focus point
        this.router.post('/focus-points', (req, res) => {
            const { id, name, coordinates, signalType, frequency, range } = req.body;
            
            if (!id || !name || !coordinates || !signalType) {
                return res.status(400).json({
                    error: 'Missing required fields: id, name, coordinates, signalType'
                });
            }
            
            if (this.focusPoints.has(id)) {
                return res.status(409).json({
                    error: 'Focus point already exists',
                    id: id
                });
            }
            
            const newFocusPoint = {
                id,
                name,
                coordinates,
                mgrs: this.convertToMGRS(coordinates),
                signalType,
                frequency: frequency || 2.4,
                range: range || 10000,
                status: 'active',
                createdAt: new Date(),
                lastUpdate: new Date(),
                signalHistory: []
            };
            
            this.focusPoints.set(id, newFocusPoint);
            
            res.status(201).json({
                message: 'Focus point created successfully',
                focusPoint: newFocusPoint
            });
        });
        
        // Update focus point
        this.router.put('/focus-points/:id', (req, res) => {
            const { id } = req.params;
            const updates = req.body;
            
            const focusPoint = this.focusPoints.get(id);
            if (!focusPoint) {
                return res.status(404).json({
                    error: 'Focus point not found',
                    id: id
                });
            }
            
            const updatedFocusPoint = {
                ...focusPoint,
                ...updates,
                lastUpdate: new Date()
            };
            
            // Recalculate MGRS if coordinates changed
            if (updates.coordinates) {
                updatedFocusPoint.mgrs = this.convertToMGRS(updates.coordinates);
            }
            
            this.focusPoints.set(id, updatedFocusPoint);
            
            res.json({
                message: 'Focus point updated successfully',
                focusPoint: updatedFocusPoint
            });
        });
        
        // Get signal data for focus point
        this.router.get('/focus-points/:id/signals', (req, res) => {
            const { id } = req.params;
            const { limit = 10 } = req.query;
            
            const focusPoint = this.focusPoints.get(id);
            if (!focusPoint) {
                return res.status(404).json({
                    error: 'Focus point not found',
                    id: id
                });
            }
            
            const signals = focusPoint.signalHistory.slice(-parseInt(limit));
            const latestSignal = this.signalData.get(`${id}-latest`);
            
            res.json({
                focusPointId: id,
                latestSignal,
                signalHistory: signals,
                totalReadings: focusPoint.signalHistory.length
            });
        });
        
        // Calculate range between focus points
        this.router.post('/calculate-range', (req, res) => {
            const { fromFocusPointId, toCoordinates } = req.body;
            
            const fromFocusPoint = this.focusPoints.get(fromFocusPointId);
            if (!fromFocusPoint) {
                return res.status(404).json({
                    error: 'Source focus point not found',
                    id: fromFocusPointId
                });
            }
            
            const rangeResult = this.calculateRange(fromFocusPoint, { targetCoordinates: toCoordinates });
            
            res.json({
                from: fromFocusPoint.id,
                to: toCoordinates,
                ...rangeResult
            });
        });
        
        // Transform coordinates
        this.router.post('/transform-coordinates', (req, res) => {
            const { coordinates, fromSystem, toSystem } = req.body;
            
            if (!this.coordinateSystems.includes(fromSystem) || !this.coordinateSystems.includes(toSystem)) {
                return res.status(400).json({
                    error: 'Invalid coordinate system',
                    supportedSystems: this.coordinateSystems
                });
            }
            
            const transformed = this.transformCoordinates(
                { coordinates },
                { fromSystem, toSystem }
            );
            
            res.json({
                originalCoordinates: coordinates,
                transformedCoordinates: transformed,
                fromSystem,
                toSystem
            });
        });
        
        // Get processing queue status
        this.router.get('/processing/status', (req, res) => {
            res.json({
                queueLength: this.processingQueue.length,
                activeFocusPoints: Array.from(this.focusPoints.values())
                    .filter(fp => fp.status === 'active').length,
                totalSignalReadings: Array.from(this.focusPoints.values())
                    .reduce((sum, fp) => sum + fp.signalHistory.length, 0)
            });
        });
    }
    
    convertToMGRS(coordinates) {
        // Simplified MGRS conversion for demonstration
        const { latitude, longitude } = coordinates;
        const zone = Math.floor((longitude + 180) / 6) + 1;
        const band = String.fromCharCode(67 + Math.floor((latitude + 80) / 8));
        const square = 'DD'; // Simplified
        const easting = Math.floor((longitude + 180) % 6 * 100000).toString().padStart(5, '0');
        const northing = Math.floor((latitude + 90) * 111000 % 100000).toString().padStart(5, '0');
        
        return `${zone}${band}${square}${easting}${northing}`;
    }
    
    getStatus() {
        return {
            initialized: true,
            focusPointCount: this.focusPoints.size,
            activeFocusPoints: Array.from(this.focusPoints.values())
                .filter(fp => fp.status === 'active').length,
            processingQueueLength: this.processingQueue.length,
            supportedCoordinateSystems: this.coordinateSystems
        };
    }
    
    getRouter() {
        return this.router;
    }
}

module.exports = GISProcessor;