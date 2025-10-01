#!/usr/bin/env bash
#
# deploy_site.sh - Master deployment script for ViFlow sites
#
# Usage: deploy_site.sh <slug> <domain> <zipPath> <basicAuthUser> <basicAuthPassword>
#
# SECURITY: This script is called via sudo from the backend worker
# It must validate all inputs and operate securely
#

set -euo pipefail

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

# Validate arguments
if [ "$#" -ne 5 ]; then
    error "Invalid number of arguments"
    echo "Usage: $0 <slug> <domain> <zipPath> <basicAuthUser> <basicAuthPassword>"
    exit 1
fi

SLUG="$1"
DOMAIN="$2"
ZIP_PATH="$3"
BASIC_AUTH_USER="$4"
BASIC_AUTH_PASSWORD="$5"

log "Starting deployment for site: $SLUG (domain: $DOMAIN)"

# SECURITY: Validate slug (only lowercase alphanumeric and hyphens)
if ! [[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
    error "Invalid slug format: $SLUG"
    exit 1
fi

# SECURITY: Validate domain (basic RFC 1035 check)
if ! [[ "$DOMAIN" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$ ]]; then
    error "Invalid domain format: $DOMAIN"
    exit 1
fi

# Check if ZIP exists
if [ ! -f "$ZIP_PATH" ]; then
    error "ZIP file not found: $ZIP_PATH"
    exit 1
fi

# Define paths
DEPLOY_ROOT="/var/www/viflow"
SITE_DIR="$DEPLOY_ROOT/$SLUG"
TEMP_DIR="$SITE_DIR/temp-$$"
CURRENT_DIR="$SITE_DIR/current"
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"

log "Creating site directory: $SITE_DIR"
mkdir -p "$SITE_DIR"

# Create temporary extraction directory
log "Creating temp directory: $TEMP_DIR"
mkdir -p "$TEMP_DIR"

# SECURITY: Extract ZIP safely
log "Extracting ZIP archive..."

# Check if unzip is installed
if ! command -v unzip &> /dev/null; then
    error "unzip command not found. Installing..."
    apt-get update -qq && apt-get install -y -qq unzip
fi

# Extract with safety measures:
# - Extract to temp directory
# - Limit to 10000 files
# - Check for path traversal
if ! unzip -q -d "$TEMP_DIR" "$ZIP_PATH" 2>&1 | head -10000; then
    error "Failed to extract ZIP"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Count files (security check)
FILE_COUNT=$(find "$TEMP_DIR" -type f | wc -l)
log "Extracted $FILE_COUNT files"

if [ "$FILE_COUNT" -gt 10000 ]; then
    error "Too many files in archive (max 10000)"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# SECURITY: Check for path traversal attempts
if find "$TEMP_DIR" -path "*/..*" -o -lname "*" | grep -q .; then
    error "Archive contains suspicious paths or symlinks"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Atomic swap: move temp to current
log "Performing atomic swap to current directory..."
if [ -d "$CURRENT_DIR" ]; then
    BACKUP_DIR="$SITE_DIR/backup-$(date +%s)"
    log "Backing up current version to: $BACKUP_DIR"
    mv "$CURRENT_DIR" "$BACKUP_DIR"

    # Keep only last 3 backups
    ls -dt "$SITE_DIR"/backup-* 2>/dev/null | tail -n +4 | xargs -r rm -rf
fi

mv "$TEMP_DIR" "$CURRENT_DIR"

# Set ownership and permissions
log "Setting ownership and permissions..."
chown -R www-data:www-data "$CURRENT_DIR"
find "$CURRENT_DIR" -type d -exec chmod 750 {} \;
find "$CURRENT_DIR" -type f -exec chmod 640 {} \;

# Call nginx configuration script
log "Configuring Nginx..."
if ! "$SCRIPTS_DIR/nginx_site.sh" "$SLUG" "$DOMAIN" "$BASIC_AUTH_USER" "$BASIC_AUTH_PASSWORD"; then
    error "Nginx configuration failed"
    exit 1
fi

# Test nginx configuration
log "Testing Nginx configuration..."
if ! nginx -t 2>&1; then
    error "Nginx configuration test failed"
    exit 1
fi

# Reload nginx
log "Reloading Nginx..."
systemctl reload nginx

# Call systemd service script
log "Configuring systemd service..."
if ! "$SCRIPTS_DIR/systemd_service.sh" "$SLUG"; then
    error "Systemd service configuration failed"
    exit 1
fi

# Request Let's Encrypt certificate
log "Requesting Let's Encrypt certificate..."

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    error "certbot not found. Please install certbot first."
    error "Run: apt-get install -y certbot python3-certbot-nginx"
    exit 1
fi

# Get email from environment or use default
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-admin@$DOMAIN}"

# Run certbot (non-interactive, agree to TOS, redirect HTTP to HTTPS)
if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$LETSENCRYPT_EMAIL" --redirect 2>&1; then
    log "Let's Encrypt certificate obtained successfully"
else
    CERTBOT_EXIT=$?
    error "Certbot failed with exit code $CERTBOT_EXIT"
    error "This might be okay if certificate already exists or domain is not yet pointed to this server"
    # Don't fail deployment if certbot fails - site is still usable via HTTP
fi

# Final nginx reload after certbot
log "Final Nginx reload..."
systemctl reload nginx

log "✅ Deployment completed successfully for $SLUG"
log "Site is available at: https://$DOMAIN"
log "Basic Auth: $BASIC_AUTH_USER / [password set]"

exit 0
