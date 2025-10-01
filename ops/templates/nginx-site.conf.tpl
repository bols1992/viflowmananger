# Nginx configuration template for ViFlow site
# This template is used by nginx_site.sh
# Variables: ${domain}, ${slug}

server {
    listen 80;
    listen [::]:80;
    server_name ${domain};

    # Basic Authentication
    auth_basic "Restricted Access";
    auth_basic_user_file /etc/nginx/htpasswd/htpasswd-${slug};

    # Document root
    root /var/www/viflow/${slug}/current;
    index index.html index.htm;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Disable access logs for static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        access_log off;
        add_header Cache-Control "public, immutable";
    }

    # Main location block
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
