const AIEngine = require('../src/ai/aiEngine');

describe('AI Engine', () => {
  let aiEngine;

  beforeEach(async () => {
    aiEngine = new AIEngine();
    await aiEngine.initialize();
  });

  afterEach(async () => {
    if (aiEngine) {
      await aiEngine.shutdown();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully', () => {
      expect(aiEngine.isHealthy()).toBe(true);
      expect(aiEngine.models.size).toBeGreaterThan(0);
    });

    test('should load all required models', () => {
      expect(aiEngine.models.has('callRouting')).toBe(true);
      expect(aiEngine.models.has('trafficOptimization')).toBe(true);
      expect(aiEngine.models.has('fraudDetection')).toBe(true);
      expect(aiEngine.models.has('qualityOptimization')).toBe(true);
    });
  });

  describe('Call Routing Optimization', () => {
    test('should optimize call routing', () => {
      const callData = {
        from: '+1234567890',
        to: '+0987654321',
        systemLoad: 0.5,
        type: 'voice',
        priority: 'normal'
      };

      const result = aiEngine.optimizeCallRouting(callData);

      expect(result).toHaveProperty('recommendedServer');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('estimatedQuality');
      expect(result).toHaveProperty('reasoning');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('should handle high system load', () => {
      const callData = {
        from: '+1234567890',
        to: '+0987654321',
        systemLoad: 0.9,
        type: 'voice',
        priority: 'high'
      };

      const result = aiEngine.optimizeCallRouting(callData);
      expect(result.estimatedQuality).toBeLessThan(0.9);
    });
  });

  describe('Fraud Detection', () => {
    test('should detect low-risk calls', () => {
      const callData = {
        from: '+1234567890',
        to: '+0987654321',
        duration: 300,
        location: '192.168.1.100',
        estimatedCost: 1.50
      };

      const result = aiEngine.detectFraud(callData);

      expect(result).toHaveProperty('riskScore');
      expect(result).toHaveProperty('isFraudulent');
      expect(result).toHaveProperty('reasons');
      expect(result).toHaveProperty('recommendedAction');
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(1);
    });

    test('should detect high-risk calls', () => {
      const callData = {
        from: '+1234567890',
        to: '+0987654321',
        duration: 3600,
        location: '192.168.1.100',
        estimatedCost: 1500.00 // High cost
      };

      const result = aiEngine.detectFraud(callData);
      expect(result.riskScore).toBeGreaterThan(0.3);
    });
  });

  describe('Traffic Optimization', () => {
    test('should optimize network traffic', () => {
      const trafficData = {
        bandwidth: 1000000,
        latency: 50,
        packetLoss: 0.001,
        activeConnections: 100,
        protocol: 'HTTP',
        sourceIP: '192.168.1.100',
        destinationIP: '8.8.8.8'
      };

      const result = aiEngine.optimizeNetworkTraffic(trafficData);

      expect(result).toHaveProperty('recommendedPath');
      expect(result).toHaveProperty('qosSettings');
      expect(result).toHaveProperty('bandwidthAllocation');
      expect(result).toHaveProperty('priority');
    });

    test('should handle high latency scenarios', () => {
      const trafficData = {
        bandwidth: 1000000,
        latency: 200, // High latency
        packetLoss: 0.001,
        activeConnections: 100,
        protocol: 'HTTP',
        sourceIP: '192.168.1.100',
        destinationIP: '8.8.8.8'
      };

      const result = aiEngine.optimizeNetworkTraffic(trafficData);
      expect(result.recommendedPath).toBe('optimized');
    });
  });

  describe('Quality Optimization', () => {
    test('should optimize call quality', () => {
      const performanceData = {
        jitter: 20,
        latency: 100,
        packetLoss: 0.005,
        mos: 3.5,
        codec: 'G.711',
        bandwidth: 64000
      };

      const result = aiEngine.optimizeQuality(performanceData);

      expect(result).toHaveProperty('recommendedCodec');
      expect(result).toHaveProperty('bufferSize');
      expect(result).toHaveProperty('bandwidth');
      expect(result).toHaveProperty('compressionLevel');
    });

    test('should recommend compression for low bandwidth', () => {
      const performanceData = {
        jitter: 20,
        latency: 100,
        packetLoss: 0.005,
        mos: 3.5,
        codec: 'G.711',
        bandwidth: 512 // Low bandwidth
      };

      const result = aiEngine.optimizeQuality(performanceData);
      expect(result.compressionLevel).toBe('high');
    });
  });

  describe('Capacity Prediction', () => {
    test('should predict capacity requirements', () => {
      const currentMetrics = {
        calls: 100,
        bandwidth: 1000000,
        connections: 500
      };

      const result = aiEngine.predictCapacity(currentMetrics);

      expect(result).toHaveProperty('nextHour');
      expect(result).toHaveProperty('nextDay');
      expect(result).toHaveProperty('nextWeek');
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('Health Check', () => {
    test('should report healthy status when initialized', () => {
      expect(aiEngine.isHealthy()).toBe(true);
    });

    test('should report unhealthy status after shutdown', async () => {
      await aiEngine.shutdown();
      expect(aiEngine.isHealthy()).toBe(false);
    });
  });
});