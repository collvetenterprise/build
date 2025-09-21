const DynamicBuildEnvironment = require('../src/index');
const request = require('supertest');

describe('Dynamic Build Environment', () => {
    let app;
    let server;
    
    beforeAll(async () => {
        const dbe = new DynamicBuildEnvironment();
        app = dbe.app;
        
        // Initialize all components
        await dbe.buildManager.initialize();
        await dbe.mcpAccessPoint.initialize();
        await dbe.gisProcessor.initialize();
        await dbe.agentPortal.initialize();
        await dbe.mgrsHandler.initialize();
    });
    
    afterAll(async () => {
        if (server) {
            server.close();
        }
    });
    
    describe('Health Check', () => {
        test('should return healthy status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);
                
            expect(response.body.status).toBe('healthy');
            expect(response.body.components).toBeDefined();
            expect(response.body.components.buildManager).toBeDefined();
            expect(response.body.components.mcpAccessPoint).toBeDefined();
            expect(response.body.components.gisProcessor).toBeDefined();
            expect(response.body.components.agentPortal).toBeDefined();
            expect(response.body.components.mgrsHandler).toBeDefined();
        });
    });
    
    describe('Build Manager API', () => {
        test('should return build status', async () => {
            const response = await request(app)
                .get('/api/build/status')
                .expect(200);
                
            expect(response.body.currentTier).toBeDefined();
            expect(response.body.availableTiers).toContain('dev');
            expect(response.body.availableTiers).toContain('staging');
            expect(response.body.availableTiers).toContain('prod');
        });
        
        test('should trigger build for valid tier', async () => {
            const response = await request(app)
                .post('/api/build/trigger/dev')
                .expect(200);
                
            expect(response.body.buildId).toBeDefined();
            expect(response.body.tier).toBe('dev');
            expect(response.body.status).toBe('success');
        });
        
        test('should reject build for invalid tier', async () => {
            await request(app)
                .post('/api/build/trigger/invalid')
                .expect(400);
        });
    });
    
    describe('MCP Access Points API', () => {
        test('should list access points', async () => {
            const response = await request(app)
                .get('/api/mcp/access-points')
                .expect(200);
                
            expect(response.body.accessPoints).toBeDefined();
            expect(response.body.totalCount).toBeGreaterThan(0);
            expect(response.body.activeCount).toBeGreaterThan(0);
        });
        
        test('should create new access point', async () => {
            const newAccessPoint = {
                id: 'test-ap-001',
                type: 'test',
                endpoint: '/mcp/test',
                protocols: ['http'],
                authentication: 'none'
            };
            
            const response = await request(app)
                .post('/api/mcp/access-points')
                .send(newAccessPoint)
                .expect(201);
                
            expect(response.body.message).toBe('Access point created successfully');
            expect(response.body.accessPoint.id).toBe(newAccessPoint.id);
        });
    });
    
    describe('GIS Processor API', () => {
        test('should list focus points', async () => {
            const response = await request(app)
                .get('/api/gis/focus-points')
                .expect(200);
                
            expect(response.body.focusPoints).toBeDefined();
            expect(response.body.totalCount).toBeGreaterThan(0);
        });
        
        test('should calculate range between coordinates', async () => {
            const rangeRequest = {
                fromFocusPointId: 'fp-001',
                toCoordinates: {
                    latitude: 40.0000,
                    longitude: -105.0000
                }
            };
            
            const response = await request(app)
                .post('/api/gis/calculate-range')
                .send(rangeRequest)
                .expect(200);
                
            expect(response.body.distance).toBeDefined();
            expect(response.body.bearing).toBeDefined();
            expect(response.body.inRange).toBeDefined();
        });
    });
    
    describe('Agent Portal API', () => {
        test('should list agents', async () => {
            const response = await request(app)
                .get('/api/agents/agents')
                .expect(200);
                
            expect(response.body.agents).toBeDefined();
            expect(response.body.totalCount).toBeGreaterThan(0);
            expect(response.body.activeCount).toBeGreaterThan(0);
        });
        
        test('should register new agent', async () => {
            const newAgent = {
                id: 'test-agent-001',
                name: 'Test Agent',
                type: 'test',
                capabilities: ['testing']
            };
            
            const response = await request(app)
                .post('/api/agents/agents')
                .send(newAgent)
                .expect(201);
                
            expect(response.body.message).toBe('Agent registered successfully');
            expect(response.body.agent.id).toBe(newAgent.id);
        });
    });
    
    describe('MGRS Handler API', () => {
        test('should convert coordinates to MGRS', async () => {
            const coordinates = {
                latitude: 39.7392,
                longitude: -104.9903,
                precision: 5
            };
            
            const response = await request(app)
                .post('/api/mgrs/convert/to-mgrs')
                .send(coordinates)
                .expect(200);
                
            expect(response.body.mgrs).toBeDefined();
            expect(response.body.zone).toBeDefined();
            expect(response.body.band).toBeDefined();
        });
        
        test('should list grid points', async () => {
            const response = await request(app)
                .get('/api/mgrs/grid')
                .expect(200);
                
            expect(response.body.gridPoints).toBeDefined();
            expect(response.body.totalCount).toBeGreaterThan(0);
        });
        
        test('should calculate distance between MGRS points', async () => {
            const distanceRequest = {
                fromMGRS: '13SDD1234567890',
                toMGRS: '13SDD2345678901'
            };
            
            const response = await request(app)
                .post('/api/mgrs/calculate-distance')
                .send(distanceRequest)
                .expect(200);
                
            expect(response.body.distance).toBeDefined();
            expect(response.body.bearing).toBeDefined();
        });
    });
});