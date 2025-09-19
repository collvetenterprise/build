const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const config = require('config')
const logger = require('./utils/logger')
const PhoneServer = require('./phone/phoneServer')
const InternetGateway = require('./gateway/internetGateway')
const AIEngine = require('./ai/aiEngine')
const apiRoutes = require('./api/routes')

class Application {
  constructor () {
    this.app = express()
    this.phoneServer = null
    this.gateway = null
    this.aiEngine = null
    this.port = config.get('server.port') || 8080
  }

  async initialize () {
    try {
      // Setup middleware
      this.setupMiddleware()

      // Initialize AI Engine first
      this.aiEngine = new AIEngine()
      await this.aiEngine.initialize()
      logger.info('AI Engine initialized successfully')

      // Initialize Phone Server
      this.phoneServer = new PhoneServer(this.aiEngine)
      await this.phoneServer.initialize()
      logger.info('Phone Server initialized successfully')

      // Initialize Internet Gateway
      this.gateway = new InternetGateway(this.aiEngine)
      await this.gateway.initialize()
      logger.info('Internet Gateway initialized successfully')

      // Setup API routes
      this.setupRoutes()

      // Start HTTP server
      this.server = this.app.listen(this.port, () => {
        logger.info(`AI Phone Gateway server running on port ${this.port}`)
      })

      // Setup graceful shutdown
      this.setupGracefulShutdown()
    } catch (error) {
      logger.error('Failed to initialize application:', error)
      process.exit(1)
    }
  }

  setupMiddleware () {
    this.app.use(helmet())
    this.app.use(cors())
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true }))

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path} - ${req.ip}`)
      next()
    })
  }

  setupRoutes () {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          phoneServer: this.phoneServer?.isHealthy() || false,
          gateway: this.gateway?.isHealthy() || false,
          aiEngine: this.aiEngine?.isHealthy() || false
        }
      })
    })

    // API routes
    this.app.use('/api', apiRoutes(this.phoneServer, this.gateway, this.aiEngine))

    // Serve dashboard (static files would go here)
    this.app.get('/', (req, res) => {
      res.json({
        name: 'AI Phone Gateway',
        version: '1.0.0',
        description: 'AI-powered phone server and internet gateway',
        endpoints: {
          health: '/health',
          api: '/api',
          docs: '/api/docs'
        }
      })
    })

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' })
    })

    // Error handler
    this.app.use((err, req, res, _next) => {
      logger.error('Unhandled error:', err)
      res.status(500).json({ error: 'Internal server error' })
    })
  }

  setupGracefulShutdown () {
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`)

      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed')
        })
      }

      if (this.phoneServer) {
        await this.phoneServer.shutdown()
      }

      if (this.gateway) {
        await this.gateway.shutdown()
      }

      if (this.aiEngine) {
        await this.aiEngine.shutdown()
      }

      logger.info('Graceful shutdown completed')
      process.exit(0)
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  }
}

// Start the application
if (require.main === module) {
  const app = new Application()
  app.initialize().catch(error => {
    logger.error('Failed to start application:', error)
    process.exit(1)
  })
}

module.exports = Application
