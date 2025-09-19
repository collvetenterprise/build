const request = require('supertest');
const Application = require('../src/index');

describe('AI Phone Gateway API', () => {
  let app;
  let server;

  beforeAll(async () => {
    app = new Application();
    await app.initialize();
    server = app.app;
  });

  afterAll(async () => {
    if (app.phoneServer) await app.phoneServer.shutdown();
    if (app.gateway) await app.gateway.shutdown();
    if (app.aiEngine) await app.aiEngine.shutdown();
    if (app.server) app.server.close();
  });

  describe('Health Check', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(server)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('services');
      expect(response.body.services).toHaveProperty('phoneServer');
      expect(response.body.services).toHaveProperty('gateway');
      expect(response.body.services).toHaveProperty('aiEngine');
    });
  });

  describe('Phone Server API', () => {
    test('GET /api/phone/stats should return phone statistics', async () => {
      const response = await request(server)
        .get('/api/phone/stats')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('active');
      expect(response.body.data).toHaveProperty('completed');
      expect(response.body.data).toHaveProperty('failed');
    });

    test('GET /api/phone/calls should return active calls', async () => {
      const response = await request(server)
        .get('/api/phone/calls')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('activeCalls');
      expect(response.body.data).toHaveProperty('count');
      expect(Array.isArray(response.body.data.activeCalls)).toBe(true);
    });

    test('GET /api/phone/clients should return registered clients', async () => {
      const response = await request(server)
        .get('/api/phone/clients')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('clients');
      expect(response.body.data).toHaveProperty('count');
      expect(Array.isArray(response.body.data.clients)).toBe(true);
    });
  });

  describe('Gateway API', () => {
    test('GET /api/gateway/stats should return gateway statistics', async () => {
      const response = await request(server)
        .get('/api/gateway/stats')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('totalBytes');
      expect(response.body.data).toHaveProperty('totalPackets');
      expect(response.body.data).toHaveProperty('activeConnections');
    });

    test('GET /api/gateway/connections should return active connections', async () => {
      const response = await request(server)
        .get('/api/gateway/connections')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('connections');
      expect(response.body.data).toHaveProperty('count');
      expect(Array.isArray(response.body.data.connections)).toBe(true);
    });

    test('GET /api/gateway/security should return security information', async () => {
      const response = await request(server)
        .get('/api/gateway/security')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('rules');
      expect(response.body.data).toHaveProperty('blockedRequests');
    });
  });

  describe('AI Engine API', () => {
    test('GET /api/ai/models should return AI models information', async () => {
      const response = await request(server)
        .get('/api/ai/models')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('models');
      expect(response.body.data).toHaveProperty('count');
      expect(response.body.data).toHaveProperty('isHealthy');
    });

    test('POST /api/ai/optimize/call should optimize call routing', async () => {
      const callData = {
        from: '+1234567890',
        to: '+0987654321',
        systemLoad: 0.5,
        type: 'voice',
        priority: 'normal'
      };

      const response = await request(server)
        .post('/api/ai/optimize/call')
        .send({ callData })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('recommendedServer');
      expect(response.body.data).toHaveProperty('confidence');
      expect(response.body.data).toHaveProperty('estimatedQuality');
    });

    test('POST /api/ai/analyze/fraud should analyze fraud', async () => {
      const callData = {
        from: '+1234567890',
        to: '+0987654321',
        duration: 300,
        location: '192.168.1.100',
        estimatedCost: 5.50
      };

      const response = await request(server)
        .post('/api/ai/analyze/fraud')
        .send({ callData })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('riskScore');
      expect(response.body.data).toHaveProperty('isFraudulent');
      expect(response.body.data).toHaveProperty('reasons');
    });

    test('POST /api/ai/optimize/traffic should optimize traffic', async () => {
      const trafficData = {
        bandwidth: 1000000,
        latency: 50,
        packetLoss: 0.001,
        activeConnections: 100,
        protocol: 'HTTP',
        sourceIP: '192.168.1.100',
        destinationIP: '8.8.8.8'
      };

      const response = await request(server)
        .post('/api/ai/optimize/traffic')
        .send({ trafficData })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('recommendedPath');
      expect(response.body.data).toHaveProperty('qosSettings');
    });

    test('GET /api/ai/capacity/predict should predict capacity', async () => {
      const response = await request(server)
        .get('/api/ai/capacity/predict')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('nextHour');
      expect(response.body.data).toHaveProperty('nextDay');
      expect(response.body.data).toHaveProperty('recommendations');
    });
  });

  describe('System API', () => {
    test('GET /api/system/overview should return system overview', async () => {
      const response = await request(server)
        .get('/api/system/overview')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('phoneServer');
      expect(response.body.data).toHaveProperty('gateway');
      expect(response.body.data).toHaveProperty('aiEngine');
    });

    test('GET /api/system/metrics should return system metrics', async () => {
      const response = await request(server)
        .get('/api/system/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('phone');
      expect(response.body.data).toHaveProperty('gateway');
      expect(response.body.data).toHaveProperty('ai');
      expect(response.body.data).toHaveProperty('system');
    });
  });

  describe('API Documentation', () => {
    test('GET /api/docs should return API documentation', async () => {
      const response = await request(server)
        .get('/api/docs')
        .expect(200);

      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body).toHaveProperty('examples');
    });
  });

  describe('Error Handling', () => {
    test('GET /nonexistent should return 404', async () => {
      const response = await request(server)
        .get('/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Not found');
    });

    test('POST /api/ai/optimize/call without data should return 400', async () => {
      const response = await request(server)
        .post('/api/ai/optimize/call')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });
});