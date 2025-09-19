const express = require('express')
const router = express.Router()

module.exports = (phoneServer, gateway, aiEngine) => {
  // Phone Server endpoints
  router.get('/phone/stats', (req, res) => {
    try {
      const stats = phoneServer.getStats()
      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  router.get('/phone/calls', (req, res) => {
    try {
      const activeCalls = Array.from(phoneServer.activeCalls.values()).map(call => ({
        id: call.id,
        from: call.from,
        to: call.to,
        status: call.status,
        startTime: call.startTime,
        duration: call.endTime ? call.endTime - call.startTime : Date.now() - call.startTime,
        quality: call.quality
      }))

      res.json({
        success: true,
        data: {
          activeCalls,
          count: activeCalls.length
        }
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  router.get('/phone/clients', (req, res) => {
    try {
      const clients = Array.from(phoneServer.registeredClients.entries()).map(([id, client]) => ({
        id,
        contact: client.contact,
        userAgent: client.userAgent,
        registeredAt: client.registeredAt,
        expires: client.expires
      }))

      res.json({
        success: true,
        data: {
          clients,
          count: clients.length
        }
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  // Gateway endpoints
  router.get('/gateway/stats', (req, res) => {
    try {
      const stats = gateway.getStats()
      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  router.get('/gateway/connections', (req, res) => {
    try {
      const connections = Array.from(gateway.connections.values()).map(conn => ({
        id: conn.id,
        remoteAddress: conn.remoteAddress,
        remotePort: conn.remotePort,
        startTime: conn.startTime,
        status: conn.status,
        bytesReceived: conn.bytesReceived,
        bytesSent: conn.bytesSent,
        duration: conn.endTime ? conn.endTime - conn.startTime : Date.now() - conn.startTime
      }))

      res.json({
        success: true,
        data: {
          connections,
          count: connections.length
        }
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  router.get('/gateway/security', (req, res) => {
    try {
      const securityRules = {}
      gateway.securityRules.forEach((rule, name) => {
        securityRules[name] = {
          ...rule,
          blockedIPs: rule.blockedIPs ? Array.from(rule.blockedIPs) : undefined,
          blockedDomains: rule.blockedDomains ? Array.from(rule.blockedDomains) : undefined
        }
      })

      res.json({
        success: true,
        data: {
          rules: securityRules,
          blockedRequests: gateway.trafficStats.blockedRequests
        }
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  // AI Engine endpoints
  router.get('/ai/models', (req, res) => {
    try {
      const models = {}
      aiEngine.models.forEach((model, name) => {
        models[name] = {
          type: model.type,
          accuracy: model.accuracy,
          lastTrained: model.lastTrained
        }
      })

      res.json({
        success: true,
        data: {
          models,
          count: aiEngine.models.size,
          isHealthy: aiEngine.isHealthy()
        }
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  router.post('/ai/optimize/call', (req, res) => {
    try {
      const { callData } = req.body
      if (!callData) {
        return res.status(400).json({
          success: false,
          error: 'Call data is required'
        })
      }

      const optimization = aiEngine.optimizeCallRouting(callData)
      res.json({
        success: true,
        data: optimization
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  router.post('/ai/analyze/fraud', (req, res) => {
    try {
      const { callData } = req.body
      if (!callData) {
        return res.status(400).json({
          success: false,
          error: 'Call data is required'
        })
      }

      const analysis = aiEngine.detectFraud(callData)
      res.json({
        success: true,
        data: analysis
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  router.post('/ai/optimize/traffic', (req, res) => {
    try {
      const { trafficData } = req.body
      if (!trafficData) {
        return res.status(400).json({
          success: false,
          error: 'Traffic data is required'
        })
      }

      const optimization = aiEngine.optimizeNetworkTraffic(trafficData)
      res.json({
        success: true,
        data: optimization
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  router.get('/ai/analytics', (req, res) => {
    try {
      const analytics = {
        callQuality: Object.fromEntries(aiEngine.analytics.callQuality),
        networkTraffic: Object.fromEntries(aiEngine.analytics.networkTraffic),
        performance: Object.fromEntries(aiEngine.analytics.performance)
      }

      res.json({
        success: true,
        data: analytics
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  router.get('/ai/capacity/predict', (req, res) => {
    try {
      const currentMetrics = {
        calls: phoneServer.activeCalls.size,
        bandwidth: gateway.calculateThroughput(),
        connections: gateway.connections.size
      }

      const prediction = aiEngine.predictCapacity(currentMetrics)
      res.json({
        success: true,
        data: prediction
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  // System-wide endpoints
  router.get('/system/overview', (req, res) => {
    try {
      const overview = {
        phoneServer: {
          isHealthy: phoneServer.isHealthy(),
          stats: phoneServer.getStats()
        },
        gateway: {
          isHealthy: gateway.isHealthy(),
          stats: gateway.getStats()
        },
        aiEngine: {
          isHealthy: aiEngine.isHealthy(),
          modelCount: aiEngine.models.size
        },
        timestamp: new Date().toISOString()
      }

      res.json({
        success: true,
        data: overview
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  router.get('/system/metrics', (req, res) => {
    try {
      const metrics = {
        phone: phoneServer.getStats(),
        gateway: gateway.getStats(),
        ai: {
          models: aiEngine.models.size,
          isHealthy: aiEngine.isHealthy()
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        }
      }

      res.json({
        success: true,
        data: metrics
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  })

  // API Documentation endpoint
  router.get('/docs', (req, res) => {
    const documentation = {
      title: 'AI Phone Gateway API',
      version: '1.0.0',
      description: 'API for AI-powered phone server and internet gateway',
      endpoints: {
        phone: {
          '/api/phone/stats': 'GET - Get phone server statistics',
          '/api/phone/calls': 'GET - Get active calls',
          '/api/phone/clients': 'GET - Get registered clients'
        },
        gateway: {
          '/api/gateway/stats': 'GET - Get gateway statistics',
          '/api/gateway/connections': 'GET - Get active connections',
          '/api/gateway/security': 'GET - Get security rules and stats'
        },
        ai: {
          '/api/ai/models': 'GET - Get AI models information',
          '/api/ai/optimize/call': 'POST - Optimize call routing',
          '/api/ai/analyze/fraud': 'POST - Analyze fraud in call',
          '/api/ai/optimize/traffic': 'POST - Optimize network traffic',
          '/api/ai/analytics': 'GET - Get AI analytics data',
          '/api/ai/capacity/predict': 'GET - Predict capacity requirements'
        },
        system: {
          '/api/system/overview': 'GET - Get system overview',
          '/api/system/metrics': 'GET - Get system metrics'
        }
      },
      examples: {
        optimizeCall: {
          method: 'POST',
          url: '/api/ai/optimize/call',
          body: {
            callData: {
              from: '+1234567890',
              to: '+0987654321',
              systemLoad: 0.5,
              type: 'voice',
              priority: 'normal'
            }
          }
        },
        analyzeFraud: {
          method: 'POST',
          url: '/api/ai/analyze/fraud',
          body: {
            callData: {
              from: '+1234567890',
              to: '+0987654321',
              duration: 300,
              location: '192.168.1.100',
              estimatedCost: 5.50
            }
          }
        }
      }
    }

    res.json(documentation)
  })

  return router
}
