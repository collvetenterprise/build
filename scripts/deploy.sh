#!/bin/bash

# AI Phone Gateway Deployment Script
# Automates deployment to production environment

set -e

echo "🚀 Deploying AI Phone Gateway to Production..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_IMAGE="ai-phone-gateway"
DOCKER_TAG="${1:-latest}"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"

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

# Pre-deployment checks
pre_deployment_checks() {
    print_status "Running pre-deployment checks..."
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Check if required files exist
    required_files=(
        "docker-compose.yml"
        "config/production.yml"
        "package.json"
        "src/index.js"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            print_error "Required file not found: $file"
            exit 1
        fi
    done
    
    print_success "Pre-deployment checks passed"
}

# Create backup
create_backup() {
    print_status "Creating backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup database
    if docker-compose ps postgres | grep -q "Up"; then
        print_status "Backing up database..."
        docker-compose exec -T postgres pg_dump -U postgres ai_phone_gateway > "$BACKUP_DIR/database.sql"
        print_success "Database backup created"
    fi
    
    # Backup models and data
    if [ -d "models" ]; then
        cp -r models "$BACKUP_DIR/"
        print_success "Models backup created"
    fi
    
    if [ -d "data" ]; then
        cp -r data "$BACKUP_DIR/"
        print_success "Data backup created"
    fi
    
    # Backup logs
    if [ -d "logs" ]; then
        cp -r logs "$BACKUP_DIR/"
        print_success "Logs backup created"
    fi
    
    print_success "Backup created at: $BACKUP_DIR"
}

# Build Docker images
build_images() {
    print_status "Building Docker images..."
    
    # Build the main application image
    docker build -t "$DOCKER_IMAGE:$DOCKER_TAG" .
    
    if [ $? -eq 0 ]; then
        print_success "Docker image built successfully"
    else
        print_error "Failed to build Docker image"
        exit 1
    fi
    
    # Tag as latest if not already
    if [ "$DOCKER_TAG" != "latest" ]; then
        docker tag "$DOCKER_IMAGE:$DOCKER_TAG" "$DOCKER_IMAGE:latest"
    fi
}

# Run tests
run_tests() {
    print_status "Running tests..."
    
    # Run tests in a temporary container
    if docker run --rm "$DOCKER_IMAGE:$DOCKER_TAG" npm test; then
        print_success "All tests passed"
    else
        print_error "Tests failed. Deployment aborted."
        exit 1
    fi
}

# Stop existing services
stop_services() {
    print_status "Stopping existing services..."
    
    if docker-compose ps | grep -q "Up"; then
        docker-compose down
        print_success "Services stopped"
    else
        print_status "No running services found"
    fi
}

# Deploy new version
deploy_services() {
    print_status "Deploying new version..."
    
    # Update docker-compose to use new image
    export DOCKER_TAG
    
    # Start services
    docker-compose up -d
    
    if [ $? -eq 0 ]; then
        print_success "Services deployed successfully"
    else
        print_error "Failed to deploy services"
        rollback
        exit 1
    fi
}

# Health check
health_check() {
    print_status "Performing health checks..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/health &> /dev/null; then
            print_success "Health check passed"
            return 0
        fi
        
        print_status "Health check attempt $attempt/$max_attempts failed, retrying in 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    print_error "Health check failed after $max_attempts attempts"
    return 1
}

# Rollback function
rollback() {
    print_warning "Initiating rollback..."
    
    # Stop current services
    docker-compose down
    
    # Restore from backup if needed
    if [ -d "$BACKUP_DIR" ]; then
        print_status "Restoring from backup..."
        
        # Restore database
        if [ -f "$BACKUP_DIR/database.sql" ]; then
            docker-compose up -d postgres
            sleep 10
            docker-compose exec -T postgres psql -U postgres -d ai_phone_gateway < "$BACKUP_DIR/database.sql"
        fi
        
        # Restore models and data
        if [ -d "$BACKUP_DIR/models" ]; then
            rm -rf models
            cp -r "$BACKUP_DIR/models" .
        fi
        
        if [ -d "$BACKUP_DIR/data" ]; then
            rm -rf data
            cp -r "$BACKUP_DIR/data" .
        fi
    fi
    
    print_warning "Rollback completed"
}

# Clean up old images
cleanup() {
    print_status "Cleaning up old Docker images..."
    
    # Remove dangling images
    docker image prune -f
    
    # Remove old versions (keep last 3)
    docker images "$DOCKER_IMAGE" --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | \
    tail -n +2 | sort -k2 -r | tail -n +4 | awk '{print $1}' | xargs -r docker rmi
    
    print_success "Cleanup completed"
}

# Post-deployment tasks
post_deployment() {
    print_status "Running post-deployment tasks..."
    
    # Show service status
    docker-compose ps
    
    # Show logs
    print_status "Recent logs:"
    docker-compose logs --tail=20 ai-phone-gateway
    
    print_success "Deployment completed successfully!"
    echo ""
    echo "Services are running at:"
    echo "  - Main Application: http://localhost:3000"
    echo "  - Health Check: http://localhost:3000/health"
    echo "  - Grafana Dashboard: http://localhost:3001"
    echo "  - Kibana Logs: http://localhost:5601"
    echo ""
    echo "To view logs: docker-compose logs -f ai-phone-gateway"
    echo "To scale services: docker-compose up -d --scale ai-phone-gateway=3"
}

# Main deployment flow
main() {
    print_status "Starting deployment process with tag: $DOCKER_TAG"
    
    pre_deployment_checks
    create_backup
    build_images
    run_tests
    stop_services
    deploy_services
    
    if health_check; then
        cleanup
        post_deployment
    else
        print_error "Deployment failed health checks"
        rollback
        exit 1
    fi
}

# Handle script interruption
trap 'print_error "Deployment interrupted"; rollback; exit 1' INT TERM

# Check if this is a rollback command
if [ "$1" = "rollback" ]; then
    rollback
    exit 0
fi

# Run main deployment
main

print_success "Deployment script completed successfully!"