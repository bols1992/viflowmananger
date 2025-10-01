#!/usr/bin/env bash
#
# migrate.sh - Run database migrations
#

set -e

cd "$(dirname "$0")/.."

echo "🗄️  Running database migrations..."

pnpm --filter backend prisma migrate deploy

echo "✅ Migrations complete"
