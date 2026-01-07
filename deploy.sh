#!/bin/bash
# Machine Dashboard Deployment Script

set -e

echo "🚀 Machine Dashboard Deployment"
echo "================================"

# Check if PUBLIC_SERVER_URL is set
if [ -z "$PUBLIC_SERVER_URL" ]; then
    echo "⚠️  WARNING: PUBLIC_SERVER_URL not set!"
    echo "   Agent heartbeats will not work without this."
    echo "   Set it with: export PUBLIC_SERVER_URL=https://your-server.com"
    echo ""
fi

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check for docker-compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "📦 Building Docker image..."
docker compose build

echo "🔄 Starting services..."
docker compose up -d

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Status:"
docker compose ps

echo ""
echo "🌐 Access the dashboard at: http://localhost:3001"
echo ""
echo "📝 To view logs: docker compose logs -f"
echo "🛑 To stop: docker compose down"






