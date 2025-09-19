# Quick Start Guide

Get the AI-Driven Phone Server & Internet Gateway system up and running in minutes.

## Prerequisites

- Python 3.8 or higher
- pip package manager
- Git (for cloning)

## Installation

1. **Clone the repository:**
```bash
git clone https://github.com/collvetenterprise/build.git
cd build
```

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

3. **Configure the system (optional):**
```bash
# Copy and modify the configuration file
cp config/config.yaml config/config.local.yaml
# Edit config/config.local.yaml with your settings
```

## Quick Start

### 1. Run the Demo
Experience all AI innovations in action:
```bash
python demo.py
```

### 2. Start Individual Components

**Phone Server:**
```bash
python src/phone_server/main.py
```

**Internet Gateway:**
```bash
python src/internet_gateway/main.py
```

**Full System:**
```bash
python src/main.py
```

### 3. Test with Sample Data

**Test Call Processing:**
```python
import asyncio
import sys
sys.path.append('src')

from phone_server.manager import PhoneServerManager
from utils.config import ConfigManager

async def test_call():
    config = ConfigManager()
    phone_server = PhoneServerManager(config)
    await phone_server.start()
    
    call_data = {
        'call_id': 'test_001',
        'caller_number': '+1-555-0123',
        'intent': 'technical_support'
    }
    
    result = await phone_server.handle_incoming_call(call_data)
    print(f"Call processed: {result}")
    
    await phone_server.stop()

asyncio.run(test_call())
```

**Test Traffic Processing:**
```python
import asyncio
import sys
sys.path.append('src')

from internet_gateway.manager import InternetGatewayManager
from utils.config import ConfigManager

async def test_traffic():
    config = ConfigManager()
    gateway = InternetGatewayManager(config)
    await gateway.start()
    
    traffic_data = {
        'connection_id': 'conn_001',
        'source_ip': '192.168.1.100',
        'destination': 'api.example.com',
        'protocol': 'HTTPS'
    }
    
    result = await gateway.process_traffic(traffic_data)
    print(f"Traffic processed: {result}")
    
    await gateway.stop()

asyncio.run(test_traffic())
```

## Configuration

### Environment Variables
Set these environment variables for production:
```bash
export TWILIO_ACCOUNT_SID="your_twilio_sid"
export TWILIO_AUTH_TOKEN="your_twilio_token"
export ENCRYPTION_KEY="your_encryption_key"
export ADMIN_API_KEY="your_admin_key"
```

### Configuration File
Edit `config/config.yaml` to customize:
- AI model settings
- Phone server configuration
- Gateway policies
- Security settings
- Monitoring options

## AI Features Available

### Phone Server AI
- **Intelligent Call Routing** - Routes calls to best agents based on intent
- **Voice Recognition** - Converts speech to text and analyzes intent
- **Fraud Detection** - Identifies suspicious calling patterns
- **Predictive Maintenance** - Predicts and prevents server issues

### Internet Gateway AI
- **Smart Traffic Management** - Optimizes bandwidth and routing
- **Threat Detection** - Identifies and blocks cyber threats
- **QoS Optimization** - Continuously improves service quality
- **Self-Healing Networks** - Automatically fixes network issues

### Automation Engine
- **End-to-End Orchestration** - Coordinates all system components
- **Continuous Learning** - Improves performance over time
- **Self-Healing** - Automatically recovers from failures
- **Intelligent Scaling** - Scales resources based on demand

## Monitoring

### Health Checks
```bash
# Check system health
curl http://localhost:8080/health

# Check individual components
curl http://localhost:8080/health/phone-server
curl http://localhost:8080/health/gateway
```

### Metrics
Access metrics at:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000

### Logs
View logs in:
- Console output (real-time)
- Log files in `logs/` directory
- Structured JSON format for analysis

## API Usage

### Phone Server API
```python
# Handle incoming call
POST /api/calls
{
    "caller_number": "+1-555-0123",
    "caller_name": "Customer Name",
    "intent": "billing"
}

# Get call status
GET /api/calls/{call_id}

# Transfer call
POST /api/calls/{call_id}/transfer
{
    "target": "agent_id_123"
}
```

### Gateway API
```python
# Process traffic
POST /api/traffic
{
    "source_ip": "192.168.1.100",
    "destination": "example.com",
    "protocol": "HTTPS"
}

# Get network status
GET /api/network/status

# Update QoS policy
PUT /api/qos/policies/{policy_name}
{
    "priority": "high",
    "bandwidth": "100Mbps"
}
```

## Troubleshooting

### Common Issues

**Import Errors:**
```bash
# Ensure you're in the correct directory
cd /path/to/build
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"
```

**Configuration Issues:**
```bash
# Validate configuration
python -c "from src.utils.config import ConfigManager; print('Config OK')"
```

**Dependency Issues:**
```bash
# Reinstall dependencies
pip install -r requirements.txt --upgrade
```

### Performance Tuning

**For High Call Volume:**
- Increase `max_concurrent_calls` in config
- Scale phone server instances
- Optimize database connections

**For High Network Traffic:**
- Increase `max_connections` in gateway config
- Tune QoS policies
- Enable caching for static content

## Production Deployment

### Docker
```bash
# Build container
docker build -t ai-innovation .

# Run container
docker run -p 8080:8080 ai-innovation
```

### Kubernetes
```bash
# Deploy to Kubernetes
kubectl apply -f k8s/

# Scale deployment
kubectl scale deployment ai-innovation --replicas=3
```

### Cloud Deployment
- AWS: Use ECS or EKS
- Google Cloud: Use GKE
- Azure: Use AKS

## Support

- **Documentation**: See `docs/` directory
- **Examples**: Check `examples/` directory
- **Issues**: Report on GitHub
- **Community**: Join our Discord server

## License

MIT License - see LICENSE file for details.