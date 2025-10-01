#!/usr/bin/env bash
#
# nginx_site.sh - Configure Nginx site for ViFlow instance
#
# Usage: nginx_site.sh <slug> <domain> <basicAuthUser> <basicAuthPassword>
#

set -euo pipefail

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [nginx] $*"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [nginx] ERROR: $*" >&2
}

if [ "$#" -ne 4 ]; then
    error "Invalid arguments"
    echo "Usage: $0 <slug> <domain> <basicAuthUser> <basicAuthPassword>"
    exit 1
fi

SLUG="$1"
DOMAIN="$2"
BASIC_AUTH_USER="$3"
BASIC_AUTH_PASSWORD="$4"

# SECURITY: Validate inputs
if ! [[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
    error "Invalid slug format"
    exit 1
fi

if ! [[ "$DOMAIN" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$ ]]; then
    error "Invalid domain format"
    exit 1
fi

log "Configuring Nginx for $SLUG ($DOMAIN)"

# Install apache2-utils if htpasswd not available
if ! command -v htpasswd &> /dev/null; then
    log "Installing apache2-utils for htpasswd..."
    apt-get update -qq && apt-get install -y -qq apache2-utils
fi

# Create htpasswd directory
HTPASSWD_DIR="/etc/nginx/htpasswd"
mkdir -p "$HTPASSWD_DIR"

# Create/update htpasswd file with bcrypt
HTPASSWD_FILE="$HTPASSWD_DIR/htpasswd-$SLUG"
log "Creating/updating htpasswd file: $HTPASSWD_FILE"

# Use -B for bcrypt hashing (more secure)
echo "$BASIC_AUTH_PASSWORD" | htpasswd -c -i -B "$HTPASSWD_FILE" "$BASIC_AUTH_USER"

# Secure htpasswd file
chmod 640 "$HTPASSWD_FILE"
chown root:www-data "$HTPASSWD_FILE"

# Generate Nginx config from template
TEMPLATE_DIR="$(cd "$(dirname "$0")/../templates" && pwd)"
TEMPLATE_FILE="$TEMPLATE_DIR/nginx-site.conf.tpl"

if [ ! -f "$TEMPLATE_FILE" ]; then
    error "Template not found: $TEMPLATE_FILE"
    exit 1
fi

NGINX_SITE_FILE="/etc/nginx/sites-available/$SLUG"

log "Generating Nginx config: $NGINX_SITE_FILE"

# Substitute variables in template
sed -e "s/\${domain}/$DOMAIN/g" \
    -e "s/\${slug}/$SLUG/g" \
    "$TEMPLATE_FILE" > "$NGINX_SITE_FILE"

# Enable site (create symlink)
SITES_ENABLED="/etc/nginx/sites-enabled/$SLUG"
if [ ! -L "$SITES_ENABLED" ]; then
    log "Enabling site..."
    ln -s "$NGINX_SITE_FILE" "$SITES_ENABLED"
else
    log "Site already enabled"
fi

# Test configuration
log "Testing Nginx configuration..."
if ! nginx -t 2>&1; then
    error "Nginx configuration test failed"
    exit 1
fi

log "✅ Nginx configuration successful"
exit 0
