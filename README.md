# Enterprise Network Automation Platform

A comprehensive automation solution for managing Android Franklin T10 gateways and HP ProLiant DL380 servers with AI-powered monitoring and control capabilities.

## Features

### Franklin T10 Gateway Automation
- Web interface automation and monitoring
- Real-time status checking and health monitoring
- Configuration management and backup
- Network traffic analysis
- Automatic failover and recovery

### HP ProLiant DL380 Server Automation
- iLO API integration for remote management
- Power control and thermal monitoring
- Hardware health monitoring and alerting
- Predictive maintenance with AI
- Automated backup and recovery

### AI-Powered Features
- Intelligent call routing and traffic management
- Predictive failure detection
- Automated threat detection and response
- Self-healing network capabilities
- Performance optimization

### Central Orchestration
- Unified management dashboard
- Automated scheduling and task execution
- Multi-device coordination
- Real-time monitoring and alerting
- Configuration synchronization

## Quick Start

1. Clone the repository
2. Install dependencies: `pip install -r requirements.txt`
3. Configure devices in `config/main.yml`
4. Run the demo: `python demo.py`
5. Start the automation platform: `python main.py`

### Quick Demo

Run the included demonstration script to see the platform capabilities:

```bash
python demo.py
```

This will show:
- ✅ Configuration management and validation
- ✅ Database operations and data persistence  
- ✅ Alert system functionality
- ✅ AI components (if dependencies available)
- ✅ Web dashboard setup

## Architecture

```
├── automation/          # Core automation modules
├── ai/                 # AI and machine learning components
├── config/             # Configuration files
├── scripts/            # Utility scripts
├── monitoring/         # Monitoring and alerting
├── web/               # Web dashboard
└── docs/              # Documentation
```

## Documentation

See the `docs/` directory for detailed documentation on:
- Installation and setup
- Device configuration
- API reference
- Troubleshooting guide

## License

MIT License - see LICENSE file for details.