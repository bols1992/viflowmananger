# Deployment Guide - Schritt für Schritt

Dieser Guide führt Sie durch ein vollständiges Produktions-Deployment auf Ubuntu 22.04 LTS.

## 🎯 Ziel

Nach diesem Guide haben Sie:
- ViFlow Manager läuft als systemd Service
- Nginx als Reverse Proxy mit HTTPS
- Redis für Job Queue
- Automatische Deployments funktionieren
- Let's Encrypt Zertifikate mit Auto-Renewal

---

## 📋 Voraussetzungen

- Frischer Ubuntu 22.04 Server (dediziert oder VPS)
- Root/sudo Zugriff
- Domain mit DNS A-Record auf Server-IP
- Mindestens 2GB RAM, 20GB Disk

---

## ⏱️ Geschätzte Dauer

60-90 Minuten für komplettes Setup

---

## 🚀 Schritt 1: System-Vorbereitung

```bash
# System aktualisieren
sudo apt-get update
sudo apt-get upgrade -y

# Swap erstellen (falls nicht vorhanden, für <4GB RAM)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Firewall einrichten
sudo apt-get install -y ufw
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw --force enable

# NTP für korrekte Zeitzone
sudo timedatectl set-timezone Europe/Berlin  # Anpassen
```

---

## 🔧 Schritt 2: Software installieren

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
sudo npm install -g pnpm

# Redis
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Nginx
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Utilities
sudo apt-get install -y git curl wget unzip apache2-utils

# Optionale Sicherheit
sudo apt-get install -y fail2ban
```

**Prüfen**:
```bash
node --version   # v20.x.x
pnpm --version   # 8.x.x
redis-cli ping   # PONG
nginx -v         # nginx/1.x.x
certbot --version
```

---

## 👤 Schritt 3: Benutzer & Verzeichnisse

```bash
# System-Benutzer erstellen
sudo useradd -r -m -s /bin/bash viflowapp

# SSH-Key für Deployment (optional, für Git-Zugriff)
sudo -u viflowapp ssh-keygen -t ed25519 -C "viflow@$(hostname)" -f /home/viflowapp/.ssh/id_ed25519 -N ""

# Verzeichnisse
sudo mkdir -p /opt/viflow
sudo mkdir -p /srv/viflow/uploads
sudo mkdir -p /var/www/viflow
sudo mkdir -p /var/log/viflow

# Permissions
sudo chown viflowapp:viflowapp /opt/viflow
sudo chown viflowapp:www-data /srv/viflow
sudo chmod 755 /srv/viflow
sudo chown www-data:www-data /var/www/viflow
sudo chmod 755 /var/www/viflow
sudo chown viflowapp:viflowapp /var/log/viflow
```

---

## 📦 Schritt 4: Code deployen

```bash
# Als viflowapp User
sudo -u viflowapp bash

cd /opt/viflow

# Repository klonen
git clone https://github.com/youruser/viflow-manager.git .
# ODER: Code hochladen via scp/rsync

# Umgebungsvariablen
cp .env.example .env

# ⚠️ KRITISCH: .env bearbeiten!
nano .env
```

**Wichtige .env Werte**:
```bash
NODE_ENV=production
PORT=8080

# 64+ zufällige Zeichen!
JWT_SECRET=$(openssl rand -hex 32)

DATABASE_URL=file:/opt/viflow/apps/backend/viflow.db
REDIS_URL=redis://localhost:6379

UPLOAD_DIR=/srv/viflow/uploads
DEPLOY_ROOT=/var/www/viflow
SCRIPTS_DIR=/opt/viflow/ops/scripts

MAX_UPLOAD_SIZE=2147483648  # 2GB

BASIC_AUTH_DEFAULT_USER=viewer

# Sicheres Admin-Passwort!
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=<STARKES-PASSWORT>

# Ihre tatsächliche Domain
CORS_ORIGINS=https://manager.yourdomain.com

# Für Let's Encrypt
LETSENCRYPT_EMAIL=admin@yourdomain.com
```

**Datei sichern**:
```bash
chmod 600 .env
```

**Installation**:
```bash
# Dependencies
pnpm install

# Prisma
pnpm --filter backend prisma:generate
pnpm --filter backend prisma:migrate

# Admin-User erstellen
pnpm --filter backend prisma:seed

# Build
pnpm -r build

exit  # Zurück zu root/sudo
```

---

## 🔐 Schritt 5: Sudoers konfigurieren

```bash
# Sudoers-Datei installieren
sudo cp /opt/viflow/ops/sudoers.d/viflow-deployer /etc/sudoers.d/viflow-deployer
sudo chmod 440 /etc/sudoers.d/viflow-deployer

# KRITISCH: Syntax prüfen!
sudo visudo -c

# Testen
sudo -u viflowapp sudo -l
# Sollte erlaubte Befehle anzeigen
```

---

## 🔧 Schritt 6: Deployment-Skripte

```bash
# Ausführbar machen
sudo chmod +x /opt/viflow/ops/scripts/*.sh

# Ownership
sudo chown root:root /opt/viflow/ops/scripts/*.sh

# Test (optional)
sudo -u viflowapp sudo /opt/viflow/ops/scripts/nginx_site.sh --help || echo "Script bereit"
```

---

## 🏃 Schritt 7: Backend als systemd Service

Datei erstellen: `/etc/systemd/system/viflow-backend.service`

```bash
sudo nano /etc/systemd/system/viflow-backend.service
```

**Inhalt**:
```ini
[Unit]
Description=ViFlow Manager Backend
After=network.target redis.service

[Service]
Type=simple
User=viflowapp
Group=viflowapp
WorkingDirectory=/opt/viflow/apps/backend
Environment="NODE_ENV=production"
EnvironmentFile=/opt/viflow/.env
ExecStart=/usr/bin/node /opt/viflow/apps/backend/dist/index.js

Restart=always
RestartSec=10

StandardOutput=journal
StandardError=journal
SyslogIdentifier=viflow-backend

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/viflow /var/www/viflow /opt/viflow/apps/backend /var/log/viflow

[Install]
WantedBy=multi-user.target
```

**Aktivieren**:
```bash
sudo systemctl daemon-reload
sudo systemctl enable viflow-backend
sudo systemctl start viflow-backend

# Status prüfen
sudo systemctl status viflow-backend

# Logs
sudo journalctl -u viflow-backend -f
```

**Erwartete Ausgabe**:
```
✅ Server running on port 8080
✅ Deployment worker started
```

---

## 🌐 Schritt 8: Nginx Reverse Proxy

Datei erstellen: `/etc/nginx/sites-available/viflow-manager`

```bash
sudo nano /etc/nginx/sites-available/viflow-manager
```

**Inhalt**:
```nginx
# ViFlow Manager Web-UI
server {
    listen 80;
    listen [::]:80;
    server_name manager.yourdomain.com;  # ANPASSEN!

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (statische Dateien)
    location / {
        root /opt/viflow/apps/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts für lange Uploads
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8080;
        access_log off;
    }
}
```

**Aktivieren**:
```bash
sudo ln -s /etc/nginx/sites-available/viflow-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔒 Schritt 9: HTTPS mit Let's Encrypt

```bash
# Zertifikat beantragen
sudo certbot --nginx -d manager.yourdomain.com --non-interactive --agree-tos -m admin@yourdomain.com --redirect

# Prüfen
curl -I https://manager.yourdomain.com
# Sollte: HTTP/2 200
```

**Auto-Renewal prüfen**:
```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

---

## ✅ Schritt 10: Funktionstest

### 1. Web-UI aufrufen

```
https://manager.yourdomain.com
```

**Login**:
- Username: `admin` (oder aus .env)
- Passwort: (aus .env SEED_ADMIN_PASSWORD)

### 2. Test-Site erstellen

1. In UI: "Neue Webseite"
2. Name: `Test Site`
3. Domain: `test.yourdomain.com`
4. Basic Auth Passwort: `test123`
5. Erstellen

### 3. Test-ZIP hochladen

```bash
# Lokal Test-ZIP erstellen
mkdir test-site
echo "<h1>Hello from ViFlow!</h1>" > test-site/index.html
zip -r test-site.zip test-site/

# In UI hochladen
```

### 4. Deployment durchführen

1. "Hochladen" Button
2. Basic Auth Passwort eingeben: `test123`
3. "Jetzt deployen"
4. Logs beobachten

**Erwartete Logs**:
```
Starting deployment for site: test-site
Extracting ZIP archive...
Configuring Nginx...
Requesting Let's Encrypt certificate...
✅ Deployment completed successfully
```

### 5. Site aufrufen

```bash
# DNS muss auf Server zeigen!
curl -u viewer:test123 https://test.yourdomain.com

# Sollte zeigen:
# <h1>Hello from ViFlow!</h1>
```

---

## 🔍 Schritt 11: Monitoring einrichten

### Logs

```bash
# Backend
sudo journalctl -u viflow-backend -f

# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Deployed Sites
sudo journalctl -u viflow-test-site -f  # Beispiel
```

### Disk Space

```bash
# Monitoring-Cronjob
sudo crontab -e

# Hinzufügen:
0 * * * * df -h / | grep -E '^/dev/' | awk '{ if($5+0 > 85) print "WARNING: Disk usage at "$5 }' | mail -s "Disk Alert" admin@yourdomain.com
```

### Backup

```bash
# Datenbank-Backup Cronjob
sudo -u viflowapp crontab -e

# Hinzufügen:
0 2 * * * cp /opt/viflow/apps/backend/viflow.db /opt/viflow/backups/backup-$(date +\%Y\%m\%d).db
0 3 * * * find /opt/viflow/backups -name "backup-*.db" -mtime +30 -delete
```

---

## 🎉 Fertig!

Ihr ViFlow Manager ist produktionsbereit!

### Nächste Schritte

1. **Sicherheit härten**:
   - Fail2ban konfigurieren
   - SSH Key-Auth erzwingen
   - Root-Login deaktivieren

2. **Monitoring**:
   - Uptime-Monitoring (UptimeRobot, Pingdom)
   - Error Tracking (Sentry)

3. **Backup-Strategie**:
   - Offsite-Backups einrichten
   - Recovery testen!

4. **Skalierung** (bei Bedarf):
   - PostgreSQL statt SQLite
   - Separater Redis-Server
   - Load Balancer

---

## 🆘 Troubleshooting

### Backend startet nicht

```bash
sudo journalctl -u viflow-backend -n 100
# Häufige Fehler:
# - Redis nicht erreichbar
# - .env fehlt/falsch
# - Port 8080 belegt
```

### Deployment schlägt fehl

```bash
# Sudo-Test
sudo -u viflowapp sudo -l

# Manuelle Ausführung
sudo -u viflowapp sudo /opt/viflow/ops/scripts/deploy_site.sh \
  test-slug test.example.com /srv/viflow/uploads/test-slug/upload.zip viewer testpass
```

### Certbot schlägt fehl

```bash
# DNS prüfen
nslookup manager.yourdomain.com
# MUSS auf Server-IP zeigen!

# Port 80 erreichbar?
curl http://manager.yourdomain.com

# Certbot Debug
sudo certbot --nginx -d manager.yourdomain.com --dry-run -vv
```

---

## 📞 Support

Bei Problemen:
- GitHub Issues: [Link]
- Dokumentation: README.md, SECURITY.md
- Logs: Immer zuerst Logs prüfen!

---

**Viel Erfolg mit ViFlow Manager! 🚀**
