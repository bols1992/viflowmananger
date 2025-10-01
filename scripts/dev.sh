#!/usr/bin/env bash
#
# dev.sh - Start development environment
#

set -e

cd "$(dirname "$0")/.."

echo "🚀 Starting ViFlow Manager development environment..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and set proper values, especially JWT_SECRET!"
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm not found. Please install pnpm first:"
    echo "   npm install -g pnpm"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
pnpm --filter backend prisma generate

# Run migrations
echo "🗄️  Running database migrations..."
pnpm --filter backend prisma migrate dev

# Seed database
echo "🌱 Seeding database..."
pnpm --filter backend prisma db seed

# Start Redis in background
echo "🔴 Starting Redis..."
if command -v docker &> /dev/null; then
    docker-compose up -d redis
else
    echo "⚠️  Docker not found. Please start Redis manually:"
    echo "   redis-server"
fi

# Start development servers
echo "🎉 Starting development servers..."
echo "   Backend: http://localhost:8080"
echo "   Frontend: http://localhost:5173"
echo ""
echo "   Default admin credentials:"
echo "   Username: admin"
echo "   Password: admin123!"
echo ""
echo "Press Ctrl+C to stop"

pnpm dev
