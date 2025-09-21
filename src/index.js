const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import core modules
const BuildManager = require('./build/BuildManager');
const MCPAccessPoint = require('./mcp/MCPAccessPoint');
const GISProcessor = require('./gis/GISProcessor');
const AgentPortal = require('./agents/AgentPortal');
const MGRSHandler = require('./mgrs/MGRSHandler');

class DynamicBuildEnvironment {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        
        // Initialize core components
        this.buildManager = new BuildManager();
        this.mcpAccessPoint = new MCPAccessPoint();
        this.gisProcessor = new GISProcessor();
        this.agentPortal = new AgentPortal();
        this.mgrsHandler = new MGRSHandler();
        
        this.setupMiddleware();
        this.setupRoutes();
    }
    
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }
    
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                components: {
                    buildManager: this.buildManager.getStatus(),
                    mcpAccessPoint: this.mcpAccessPoint.getStatus(),
                    gisProcessor: this.gisProcessor.getStatus(),
                    agentPortal: this.agentPortal.getStatus(),
                    mgrsHandler: this.mgrsHandler.getStatus()
                }
            });
        });
        
        // Build environment routes
        this.app.use('/api/build', this.buildManager.getRouter());
        
        // MCP access point routes
        this.app.use('/api/mcp', this.mcpAccessPoint.getRouter());
        
        // GIS and signal processing routes
        this.app.use('/api/gis', this.gisProcessor.getRouter());
        
        // Agent portal routes
        this.app.use('/api/agents', this.agentPortal.getRouter());
        
        // MGRS functionality routes
        this.app.use('/api/mgrs', this.mgrsHandler.getRouter());
    }
    
    async start() {
        try {
            // Initialize all components
            await this.buildManager.initialize();
            await this.mcpAccessPoint.initialize();
            await this.gisProcessor.initialize();
            await this.agentPortal.initialize();
            await this.mgrsHandler.initialize();
            
            // Start the server
            this.app.listen(this.port, () => {
                console.log(`Dynamic Build Environment running on port ${this.port}`);
                console.log(`Health check available at http://localhost:${this.port}/health`);
            });
        } catch (error) {
            console.error('Failed to start Dynamic Build Environment:', error);
            process.exit(1);
        }
    }
}

// Start the application if this file is run directly
if (require.main === module) {
    const dbe = new DynamicBuildEnvironment();
    dbe.start();
}

module.exports = DynamicBuildEnvironment;