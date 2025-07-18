#!/bin/bash

# Glide API Gateway Deployment Script
# Usage: ./deploy.sh [environment]
# Environment: development, staging, production (default: production)

set -e

ENVIRONMENT=${1:-production}
PROJECT_NAME="glide-api-gateway"
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
ENV_FILE=".env.${ENVIRONMENT}"

echo "🚀 Deploying Glide API Gateway to ${ENVIRONMENT} environment..."

# Check if required files exist
if [ ! -f "$COMPOSE_FILE" ]; then
    echo "❌ Error: $COMPOSE_FILE not found!"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found!"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running!"
    exit 1
fi

# Create necessary directories
mkdir -p ssl
mkdir -p logs

# Pull latest images
echo "📥 Pulling latest images..."
docker-compose -f "$COMPOSE_FILE" pull

# Build the application
echo "🔨 Building application..."
docker-compose -f "$COMPOSE_FILE" build

# Stop existing services
echo "🛑 Stopping existing services..."
docker-compose -f "$COMPOSE_FILE" down

# Start services
echo "🚀 Starting services..."
docker-compose -f "$COMPOSE_FILE" up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Health check
echo "🏥 Performing health check..."
for i in {1..30}; do
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ Service is healthy!"
        break
    fi
    
    if [ $i -eq 30 ]; then
        echo "❌ Health check failed after 30 attempts!"
        docker-compose -f "$COMPOSE_FILE" logs
        exit 1
    fi
    
    echo "⏳ Attempt $i/30 - waiting for service..."
    sleep 2
done

# Show service status
echo "📊 Service status:"
docker-compose -f "$COMPOSE_FILE" ps

# Show logs
echo "📋 Recent logs:"
docker-compose -f "$COMPOSE_FILE" logs --tail=20

echo "🎉 Deployment completed successfully!"
echo "🌐 Service is running at: http://localhost:3000"
echo "📊 Health check: http://localhost:3000/health"
echo "📝 API info: http://localhost:3000/api/info"

# Optional: Run tests
if [ "$ENVIRONMENT" = "production" ]; then
    echo "🧪 Running production tests..."
    
    # Test API info endpoint
    if curl -f http://localhost:3000/api/info > /dev/null 2>&1; then
        echo "✅ API info endpoint test passed"
    else
        echo "❌ API info endpoint test failed"
    fi
    
    # Test health endpoint
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ Health endpoint test passed"
    else
        echo "❌ Health endpoint test failed"
    fi
fi

echo "🎯 Deployment script completed!"