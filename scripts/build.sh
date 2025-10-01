#!/usr/bin/env bash
#
# build.sh - Build all applications
#

set -e

cd "$(dirname "$0")/.."

echo "🔨 Building ViFlow Manager..."

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
pnpm --filter backend prisma generate

# Build backend
echo "🏗️  Building backend..."
pnpm --filter backend build

# Build frontend
echo "🏗️  Building frontend..."
pnpm --filter frontend build

echo "✅ Build complete"
echo ""
echo "Backend: apps/backend/dist"
echo "Frontend: apps/frontend/dist"
