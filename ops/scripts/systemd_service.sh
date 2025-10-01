#!/usr/bin/env bash
#
# systemd_service.sh - Configure systemd service for ViFlow instance
#
# Usage: systemd_service.sh <slug>
#
# NOTE: If your ViFlow export is purely static HTML (no backend process),
# you may not need this service at all - Nginx will serve files directly.
#

set -euo pipefail

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [systemd] $*"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [systemd] ERROR: $*" >&2
}

if [ "$#" -ne 1 ]; then
    error "Invalid arguments"
    echo "Usage: $0 <slug>"
    exit 1
fi

SLUG="$1"

# SECURITY: Validate slug
if ! [[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
    error "Invalid slug format"
    exit 1
fi

log "Configuring systemd service for $SLUG"

# Generate systemd unit from template
TEMPLATE_DIR="$(cd "$(dirname "$0")/../templates" && pwd)"
TEMPLATE_FILE="$TEMPLATE_DIR/systemd.service.tpl"

if [ ! -f "$TEMPLATE_FILE" ]; then
    error "Template not found: $TEMPLATE_FILE"
    exit 1
fi

SERVICE_FILE="/etc/systemd/system/viflow-$SLUG.service"

log "Generating systemd unit: $SERVICE_FILE"

# Substitute variables in template
sed -e "s/\${slug}/$SLUG/g" \
    "$TEMPLATE_FILE" > "$SERVICE_FILE"

# Reload systemd daemon
log "Reloading systemd daemon..."
systemctl daemon-reload

# Enable and start service
log "Enabling and starting service..."
systemctl enable "viflow-$SLUG.service"
systemctl restart "viflow-$SLUG.service"

# Check status
if systemctl is-active --quiet "viflow-$SLUG.service"; then
    log "✅ Service is running"
else
    error "Service failed to start. Check with: systemctl status viflow-$SLUG.service"
    # Don't fail deployment - service might not be needed for static sites
    log "⚠️  Note: If serving static files only, you can ignore this error"
fi

log "✅ Systemd configuration complete"
exit 0
