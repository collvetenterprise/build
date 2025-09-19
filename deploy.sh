#!/bin/bash

# AI Automation System Deployment Script
# For Android Franklin T10 Gateway and HP ProLiant Server 380

set -e

echo "🚀 Starting AI Automation System deployment..."

# Check Python version
if ! python3 --version | grep -q "3.[8-9]"; then
    echo "❌ Python 3.8+ required"
    exit 1
fi

echo "✅ Python version check passed"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "📦 Installing dependencies..."
pip install -r requirements.txt

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs data models recordings

# Set up configuration
if [ ! -f "config.yaml" ]; then
    echo "⚙️ Configuration file already exists"
else
    echo "✅ Using existing configuration"
fi

# Initialize database
echo "🗄️ Initializing database..."
python3 -c "
import asyncio
import yaml
from src.utils.database import DatabaseManager

async def init_db():
    with open('config.yaml', 'r') as f:
        config = yaml.safe_load(f)
    
    db = DatabaseManager(config['database'])
    await db.initialize()
    await db.close()
    print('Database initialized successfully')

asyncio.run(init_db())
"

# Check system dependencies
echo "🔍 Checking system dependencies..."

# Check for audio support
if ! python3 -c "import speech_recognition" 2>/dev/null; then
    echo "⚠️ Audio support may require additional system packages"
    echo "   On Ubuntu/Debian: sudo apt-get install python3-pyaudio portaudio19-dev"
    echo "   On CentOS/RHEL: sudo yum install portaudio-devel"
fi

# Create systemd service file
echo "🔧 Creating systemd service file..."
cat > ai-automation.service << EOF
[Unit]
Description=AI Automation System for Franklin T10 and HP ProLiant 380
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=PATH=$(pwd)/venv/bin
ExecStart=$(pwd)/venv/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "📝 Systemd service file created: ai-automation.service"
echo "   To install: sudo cp ai-automation.service /etc/systemd/system/"
echo "   To enable: sudo systemctl enable ai-automation"
echo "   To start: sudo systemctl start ai-automation"

# Create startup script
echo "🔧 Creating startup script..."
cat > start.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
source venv/bin/activate
python main.py
EOF

chmod +x start.sh

# Create stop script
cat > stop.sh << 'EOF'
#!/bin/bash
echo "Stopping AI Automation System..."
pkill -f "python main.py" || true
echo "System stopped"
EOF

chmod +x stop.sh

# Set up log rotation
echo "🗂️ Setting up log rotation..."
cat > ai-automation-logrotate << EOF
$(pwd)/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

echo "   Log rotation config created: ai-automation-logrotate"
echo "   To install: sudo cp ai-automation-logrotate /etc/logrotate.d/"

# Create environment check script
cat > check-environment.py << 'EOF'
#!/usr/bin/env python3
"""Environment check script for AI Automation System"""

import sys
import importlib
import subprocess

def check_python_version():
    """Check Python version"""
    version = sys.version_info
    if version.major == 3 and version.minor >= 8:
        print("✅ Python version:", sys.version.split()[0])
        return True
    else:
        print("❌ Python 3.8+ required, found:", sys.version.split()[0])
        return False

def check_dependencies():
    """Check required dependencies"""
    required_packages = [
        'fastapi', 'uvicorn', 'aiohttp', 'pydantic', 'loguru',
        'numpy', 'pandas', 'scikit-learn', 'speech_recognition',
        'aiosqlite', 'yaml', 'cryptography'
    ]
    
    missing = []
    for package in required_packages:
        try:
            importlib.import_module(package.replace('-', '_'))
            print(f"✅ {package}")
        except ImportError:
            missing.append(package)
            print(f"❌ {package} - missing")
    
    return len(missing) == 0, missing

def check_system_resources():
    """Check system resources"""
    try:
        import psutil
        
        # Check CPU
        cpu_count = psutil.cpu_count()
        print(f"✅ CPU cores: {cpu_count}")
        
        # Check memory
        memory = psutil.virtual_memory()
        memory_gb = memory.total / (1024**3)
        print(f"✅ Memory: {memory_gb:.1f} GB")
        
        # Check disk space
        disk = psutil.disk_usage('.')
        disk_gb = disk.free / (1024**3)
        print(f"✅ Free disk space: {disk_gb:.1f} GB")
        
        return memory_gb >= 2 and disk_gb >= 1  # Minimum requirements
        
    except ImportError:
        print("⚠️ psutil not available for resource checking")
        return True

def main():
    print("🔍 AI Automation System Environment Check")
    print("=" * 50)
    
    checks = []
    
    print("\n📋 Python Version:")
    checks.append(check_python_version())
    
    print("\n📦 Dependencies:")
    deps_ok, missing = check_dependencies()
    checks.append(deps_ok)
    
    if missing:
        print(f"\nTo install missing packages:")
        print(f"pip install {' '.join(missing)}")
    
    print("\n💻 System Resources:")
    checks.append(check_system_resources())
    
    print("\n" + "=" * 50)
    if all(checks):
        print("✅ Environment check passed! System is ready to run.")
        return 0
    else:
        print("❌ Environment check failed! Please address the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
EOF

chmod +x check-environment.py

# Run environment check
echo "🔍 Running environment check..."
python3 check-environment.py

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Deployment completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Review and customize config.yaml for your environment"
    echo "2. Configure Franklin T10 Gateway IP and credentials"
    echo "3. Configure HP ProLiant Server 380 iLO access"
    echo "4. Start the system: ./start.sh"
    echo "5. Access API documentation: http://localhost:8000/docs"
    echo ""
    echo "For production deployment:"
    echo "- Install systemd service: sudo cp ai-automation.service /etc/systemd/system/"
    echo "- Install log rotation: sudo cp ai-automation-logrotate /etc/logrotate.d/"
    echo "- Configure firewall for port 8000"
    echo ""
else
    echo "❌ Deployment failed. Please fix environment issues and try again."
    exit 1
fi