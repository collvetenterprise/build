#!/bin/bash

# AI Phone Gateway Setup Script
# This script sets up the development environment

set -e

echo "🚀 Setting up AI Phone Gateway Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_nodejs() {
    print_status "Checking Node.js installation..."
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js $NODE_VERSION is installed"
    else
        print_error "Node.js is not installed. Please install Node.js 16+ from https://nodejs.org/"
        exit 1
    fi
}

# Check if Python is installed
check_python() {
    print_status "Checking Python installation..."
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 --version)
        print_success "$PYTHON_VERSION is installed"
    else
        print_error "Python 3 is not installed. Please install Python 3.8+ from https://python.org/"
        exit 1
    fi
}

# Install Node.js dependencies
install_node_deps() {
    print_status "Installing Node.js dependencies..."
    npm install
    print_success "Node.js dependencies installed"
}

# Install Python dependencies
install_python_deps() {
    print_status "Installing Python dependencies..."
    if command -v pip3 &> /dev/null; then
        pip3 install -r requirements.txt
        print_success "Python dependencies installed"
    else
        print_warning "pip3 not found. Please install Python dependencies manually:"
        print_warning "pip3 install -r requirements.txt"
    fi
}

# Create necessary directories
setup_directories() {
    print_status "Creating necessary directories..."
    
    directories=(
        "logs"
        "models"
        "models/production"
        "data"
        "data/production"
        "config"
        "temp"
    )
    
    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            print_status "Created directory: $dir"
        fi
    done
    
    print_success "Directory structure created"
}

# Create sample data files
create_sample_data() {
    print_status "Creating sample data files..."
    
    # Create sample blacklist
    if [ ! -f "data/blacklist.json" ]; then
        echo '["192.168.1.100", "10.0.0.50"]' > data/blacklist.json
        print_status "Created sample blacklist.json"
    fi
    
    # Create sample whitelist
    if [ ! -f "data/whitelist.json" ]; then
        echo '["192.168.1.1", "10.0.0.1", "127.0.0.1"]' > data/whitelist.json
        print_status "Created sample whitelist.json"
    fi
    
    # Create sample IP whitelist
    if [ ! -f "data/ip-whitelist.json" ]; then
        echo '["192.168.0.0/16", "10.0.0.0/8", "127.0.0.1"]' > data/ip-whitelist.json
        print_status "Created sample ip-whitelist.json"
    fi
    
    # Create sample IP blacklist
    if [ ! -f "data/ip-blacklist.json" ]; then
        echo '["192.168.1.100", "203.0.113.0/24"]' > data/ip-blacklist.json
        print_status "Created sample ip-blacklist.json"
    fi
    
    print_success "Sample data files created"
}

# Setup environment configuration
setup_env_config() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f ".env" ]; then
        cat > .env << EOF
# Development Environment Configuration
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_phone_gateway_dev
DB_USER=postgres
DB_PASSWORD=password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Security Configuration
JWT_SECRET=development-secret-key-change-in-production

# Telephony Configuration (optional)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number

# Logging Configuration
LOG_LEVEL=debug
EOF
        print_success "Created .env file with default configuration"
        print_warning "Please update .env file with your actual configuration values"
    else
        print_status ".env file already exists"
    fi
}

# Check if Docker is available
check_docker() {
    print_status "Checking Docker availability..."
    if command -v docker &> /dev/null; then
        print_success "Docker is available"
        if command -v docker-compose &> /dev/null; then
            print_success "Docker Compose is available"
            print_status "You can run the full stack with: docker-compose up"
        else
            print_warning "Docker Compose not found. Install it to run the full stack"
        fi
    else
        print_warning "Docker not found. Install Docker to run the containerized version"
    fi
}

# Run basic health checks
run_health_checks() {
    print_status "Running basic health checks..."
    
    # Check if we can load the main module
    if node -e "require('./src/index.js'); console.log('Module loads successfully')" &> /dev/null; then
        print_success "Main application module loads successfully"
    else
        print_warning "Main application module has issues. Check dependencies."
    fi
}

# Print next steps
print_next_steps() {
    echo ""
    print_success "🎉 Setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Update the .env file with your configuration"
    echo "2. Set up your database (PostgreSQL) and Redis if running locally"
    echo "3. Start the development server:"
    echo "   npm run dev"
    echo ""
    echo "Or use Docker Compose for a complete setup:"
    echo "   docker-compose up"
    echo ""
    echo "Available commands:"
    echo "   npm start       - Start the production server"
    echo "   npm run dev     - Start the development server with auto-reload"
    echo "   npm test        - Run tests"
    echo "   npm run lint    - Run code linting"
    echo "   npm run build   - Build the application"
    echo ""
    echo "For more information, check the README.md file."
}

# Main setup flow
main() {
    echo "Starting setup process..."
    
    check_nodejs
    check_python
    setup_directories
    install_node_deps
    install_python_deps
    create_sample_data
    setup_env_config
    check_docker
    run_health_checks
    print_next_steps
}

# Run main function
main

print_success "Setup script completed!"