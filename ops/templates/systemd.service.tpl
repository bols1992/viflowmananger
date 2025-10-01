# Systemd service template for ViFlow instance
# This template is used by systemd_service.sh
# Variables: ${slug}

[Unit]
Description=ViFlow Instance ${slug}
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/viflow/${slug}/current

# IMPORTANT: Replace this command with your actual ViFlow startup command
# Example for a Node.js application:
# ExecStart=/usr/bin/node server.js
# Example for a Python application:
# ExecStart=/usr/bin/python3 -m http.server 8080
# Example for a static site (no service needed):
# Comment out or remove this file if serving static files only via nginx

# Placeholder command - replace with actual ViFlow command
ExecStart=/usr/bin/env bash -c 'echo "ViFlow service ${slug} - replace with actual command" && sleep infinity'

# Restart policy
Restart=on-failure
RestartSec=10s

# Resource limits (adjust as needed)
LimitNOFILE=65535

# Security hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
