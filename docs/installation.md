# Installation and Setup Guide

## Prerequisites

- Python 3.8 or higher
- Chrome/Chromium browser (for web automation)
- Access to Franklin T10 gateway web interface
- Access to HP ProLiant iLO interface

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd build
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Install Chrome WebDriver (for Franklin T10 automation):
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install chromium-chromedriver

# macOS (using Homebrew)
brew install chromedriver

# Or download manually from https://chromedriver.chromium.org/
```

## Configuration

1. Copy the example configuration:
```bash
cp config/main.yml config/main.yml.backup
```

2. Edit `config/main.yml` with your device settings:
```yaml
devices:
  franklin_t10:
    ip_address: "192.168.0.1"  # Your gateway IP
    username: "admin"          # Gateway username
    password: "your_password"  # Gateway password
    
  hp_proliant:
    ilo_ip: "192.168.1.100"    # iLO IP address
    username: "Administrator"   # iLO username
    password: "your_password"   # iLO password
```

3. Configure alert settings (optional):
```yaml
monitoring:
  alerts:
    email:
      enabled: true
      smtp_server: "smtp.gmail.com"
      smtp_port: 587
      username: "your_email@gmail.com"
      password: "your_app_password"
      recipients: ["admin@company.com"]
    slack:
      enabled: true
      webhook_url: "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
      channel: "#alerts"
```

## Running the Platform

### Start the full automation platform:
```bash
python main.py
```

### Start only the web dashboard:
```bash
python main.py --web-only
```

### Run without web dashboard:
```bash
python main.py --no-web
```

### Enable verbose logging:
```bash
python main.py --verbose
```

## Web Dashboard

Once running, access the web dashboard at:
- http://localhost:5000 (default)
- Or the configured host/port in your configuration

The dashboard provides:
- Real-time device status
- Alert management
- Device control actions
- Historical data visualization

## Command Line Tools

### Device Control Script
```bash
# Get Franklin T10 status
python scripts/device_control.py franklin_t10 status

# Reboot Franklin T10
python scripts/device_control.py franklin_t10 reboot

# Get HP ProLiant status
python scripts/device_control.py hp_proliant status

# Power off HP ProLiant (graceful)
python scripts/device_control.py hp_proliant power_off

# Force power off HP ProLiant
python scripts/device_control.py hp_proliant power_off --force

# Get system logs
python scripts/device_control.py hp_proliant logs
```

## Troubleshooting

### Chrome WebDriver Issues
If you get WebDriver errors:
1. Ensure Chrome/Chromium is installed
2. Install chromedriver: `sudo apt-get install chromium-chromedriver`
3. Or set CHROMEDRIVER_PATH environment variable

### Connection Issues
- Verify device IP addresses are correct
- Check network connectivity to devices
- Ensure firewall allows connections
- Verify credentials are correct

### Permission Issues
- Ensure the user has permission to write to logs/ and data/ directories
- Check that the web dashboard port is available

### SSL/TLS Issues
The platform disables SSL verification for internal devices. For production:
1. Use proper SSL certificates
2. Enable SSL verification in device classes
3. Configure proper certificate paths

## File Structure

```
├── automation/           # Core automation modules
│   ├── franklin_t10.py  # Franklin T10 gateway automation
│   ├── hp_proliant.py   # HP ProLiant server automation
│   ├── orchestrator.py  # Main coordination logic
│   └── config_manager.py # Configuration management
├── ai/                  # AI and machine learning
│   ├── predictive_maintenance.py
│   └── anomaly_detection.py
├── monitoring/          # Monitoring and alerting
│   ├── dashboard.py     # Web dashboard
│   └── alerting.py      # Alert management
├── utils/               # Utility modules
│   ├── logger.py        # Logging setup
│   ├── database.py      # Database management
│   └── validation.py    # Configuration validation
├── scripts/             # Utility scripts
├── config/              # Configuration files
├── logs/                # Log files
├── data/                # Database files
└── templates/           # Web templates
```

## Security Considerations

1. **Credentials**: Store sensitive credentials in environment variables or encrypted configuration
2. **Network Security**: Run on isolated management network
3. **Access Control**: Implement proper authentication for web dashboard
4. **Logging**: Monitor logs for security events
5. **Updates**: Keep dependencies updated for security patches