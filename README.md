# ViFlow Manager

Vollständige Web-Plattform zur Verwaltung von ViFlow Server Exports mit automatisiertem Deployment, Nginx-Konfiguration, Let's Encrypt TLS-Zertifikaten und systemd-Services.

## 🎯 Features

- **Benutzer-Authentifizierung**: JWT-basierte Anmeldung mit httpOnly Cookies
- **Site-Verwaltung**: Erstellen, Verwalten und Löschen von ViFlow-Instanzen
- **Sicherer Upload**: ZIP-Upload mit Validierung, Path-Traversal-Schutz und Größenlimits
- **Automatisches Deployment**:
  - Sichere ZIP-Extraktion
  - Nginx-Konfiguration mit Basic Auth
  - Let's Encrypt TLS-Zertifikate
  - systemd Service-Management
- **Job Queue**: BullMQ für asynchrone Deployments mit Live-Logs
- **Moderne UI**: React + TailwindCSS mit Echtzeit-Feedback
- **Sicherheit**: Argon2-Passwort-Hashing, Rate-Limiting, CORS, Helmet

## 📋 Architektur

### Tech Stack

**Backend:**
- Node.js + Express + TypeScript
- Prisma ORM (SQLite/PostgreSQL)
- BullMQ + Redis für Job Queue
- Argon2 für Passwort-Hashing
- JWT-Authentifizierung
- Pino Logging

**Frontend:**
- React 18 + TypeScript
- Vite Build Tool
- TailwindCSS
- React Router
- React Hook Form + Zod
- Axios

**DevOps:**
- Nginx Reverse Proxy
- Let's Encrypt (certbot)
- systemd Services
- Docker Compose für Redis

## 🚀 Schnellstart (Entwicklung)

### Voraussetzungen

- Node.js 18+
- pnpm 8+
- Redis (via Docker oder lokal)

### Installation

```bash
# Repository klonen
git clone <repo-url> viflow-manager
cd viflow-manager

# Umgebungsvariablen konfigurieren
cp .env.example .env
# ⚠️ WICHTIG: JWT_SECRET ändern!

# Entwicklungsumgebung starten
chmod +x scripts/dev.sh
./scripts/dev.sh
```

Die Anwendung ist verfügbar unter:
- Frontend: http://localhost:5173
- Backend: http://localhost:8080

**Standard-Zugangsdaten:**
- Benutzername: `admin`
- Passwort: `admin123!`

⚠️ **SICHERHEITSWARNUNG**: Ändern Sie das Admin-Passwort vor dem Produktiveinsatz!

## 📦 Produktions-Setup (Ubuntu 22.04)

### 1. System-Voraussetzungen

```bash
# System aktualisieren
sudo apt-get update && sudo apt-get upgrade -y

# Node.js 20 installieren
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm installieren
sudo npm install -g pnpm

# Redis installieren
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Nginx installieren
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Certbot installieren
sudo apt-get install -y certbot python3-certbot-nginx

# unzip und htpasswd installieren
sudo apt-get install -y unzip apache2-utils
```

### 2. Benutzer und Verzeichnisse

```bash
# System-Benutzer für die Anwendung erstellen
sudo useradd -r -m -s /bin/bash viflowapp

# Repository nach /opt/viflow klonen
sudo mkdir -p /opt/viflow
sudo chown viflowapp:viflowapp /opt/viflow
sudo -u viflowapp git clone <repo-url> /opt/viflow
cd /opt/viflow

# Upload- und Deployment-Verzeichnisse erstellen
sudo mkdir -p /srv/viflow/uploads
sudo mkdir -p /var/www/viflow
sudo chown -R viflowapp:www-data /srv/viflow
sudo chown -R www-data:www-data /var/www/viflow
sudo chmod 755 /var/www/viflow
```

### 3. Anwendungs-Setup

```bash
# Als viflowapp Benutzer
sudo -u viflowapp bash

cd /opt/viflow

# Umgebungsvariablen konfigurieren
cp .env.example .env

# ⚠️ WICHTIG: Bearbeiten Sie .env und setzen Sie:
# - JWT_SECRET (64 zufällige Zeichen)
# - SEED_ADMIN_PASSWORD (sicheres Passwort)
# - LETSENCRYPT_EMAIL (Ihre E-Mail)
# - CORS_ORIGINS (Ihre Domain)

nano .env

# Dependencies installieren
pnpm install

# Prisma Client generieren
pnpm --filter backend prisma generate

# Datenbank migrieren
pnpm --filter backend prisma migrate deploy

# Admin-User erstellen (Passwort aus .env)
pnpm --filter backend prisma db seed

# Anwendung bauen
pnpm -r build

exit  # Zurück zu root/sudo-User
```

### 4. Sudoers Konfiguration

**⚠️ KRITISCH FÜR SICHERHEIT**: Der Backend-Prozess läuft als unprivilegierter `viflowapp` User und ruft Deployment-Skripte via `sudo` auf.

```bash
# Sudoers-Datei installieren
sudo visudo -f /etc/sudoers.d/viflow-deployer

# Inhalt aus ops/sudoers.d/viflow-deployer einfügen
# (Datei ist bereits im Repo vorhanden)

# ODER: Direkt kopieren
sudo cp /opt/viflow/ops/sudoers.d/viflow-deployer /etc/sudoers.d/viflow-deployer
sudo chmod 440 /etc/sudoers.d/viflow-deployer
sudo visudo -c  # Syntax-Check
```

**Wichtig:** Die sudoers-Datei erlaubt nur:
- Ausführung der Skripte in `/opt/viflow/ops/scripts/`
- Nginx reload/test
- systemctl für viflow-* Services
- certbot für TLS-Zertifikate
- Minimale File-System-Operationen

### 5. Skript-Berechtigungen

```bash
# Deployment-Skripte ausführbar machen
sudo chmod +x /opt/viflow/ops/scripts/*.sh

# Sicherstellen, dass Skripte root gehören (für sudo-Ausführung)
sudo chown root:root /opt/viflow/ops/scripts/*.sh
```

### 6. systemd Service für Backend

Erstellen Sie `/etc/systemd/system/viflow-backend.service`:

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
ReadWritePaths=/srv/viflow /var/www/viflow /opt/viflow/apps/backend

[Install]
WantedBy=multi-user.target
```

```bash
# Service aktivieren und starten
sudo systemctl daemon-reload
sudo systemctl enable viflow-backend
sudo systemctl start viflow-backend

# Status prüfen
sudo systemctl status viflow-backend

# Logs anzeigen
sudo journalctl -u viflow-backend -f
```

### 7. Nginx Reverse Proxy (Optional)

Wenn Sie die Web-UI über Nginx ausliefern möchten:

```nginx
# /etc/nginx/sites-available/viflow-manager
server {
    listen 80;
    server_name manager.yourdomain.com;

    # Frontend (statische Dateien)
    location / {
        root /opt/viflow/apps/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Site aktivieren
sudo ln -s /etc/nginx/sites-available/viflow-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# TLS-Zertifikat mit Let's Encrypt
sudo certbot --nginx -d manager.yourdomain.com
```

### 8. Firewall

```bash
# UFW Firewall konfigurieren
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 9. Automatische Let's Encrypt Renewal

Certbot installiert automatisch einen systemd Timer:

```bash
# Status prüfen
sudo systemctl status certbot.timer

# Manueller Test
sudo certbot renew --dry-run
```

### 10. Logrotate für Nginx

Erstellen Sie `/etc/logrotate.d/viflow-sites`:

```
/var/log/nginx/viflow-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    prerotate
        if [ -d /etc/logrotate.d/httpd-prerotate ]; then \
            run-parts /etc/logrotate.d/httpd-prerotate; \
        fi
    endscript
    postrotate
        invoke-rc.d nginx rotate >/dev/null 2>&1
    endscript
}
```

## 🔒 Sicherheitshinweise

### Kritische Punkte

1. **JWT Secret**:
   - Generieren Sie einen starken, zufälligen Secret (mindestens 64 Zeichen)
   - Ändern Sie `JWT_SECRET` in `.env` vor Produktiveinsatz
   - Niemals in Git committen

2. **Admin-Passwort**:
   - Ändern Sie `SEED_ADMIN_PASSWORD` in `.env` vor dem Seeding
   - Oder ändern Sie das Passwort nach dem ersten Login über die Datenbank

3. **Sudoers-Konfiguration**:
   - Nur minimal notwendige Befehle erlauben
   - Skripte müssen root gehören und dürfen von viflowapp nicht modifizierbar sein
   - Regelmäßig sudo-Logs prüfen: `sudo journalctl SYSLOG_IDENTIFIER=sudo`

4. **ZIP-Upload Sicherheit**:
   - Path Traversal wird geprüft (keine `..` erlaubt)
   - Symlinks werden abgelehnt
   - Dateigröße limitiert (Standard: 2GB)
   - Dateianzahl limitiert (max 10.000)
   - Magic Bytes werden geprüft

5. **CORS**:
   - Setzen Sie `CORS_ORIGINS` auf Ihre tatsächliche Domain
   - Keine Wildcards in Produktion

6. **Rate Limiting**:
   - Login: 5 Versuche pro 15 Minuten
   - API: 100 Requests pro 15 Minuten pro IP
   - Bei Bedarf in `src/index.ts` anpassen

7. **HTTPS**:
   - **Immer** HTTPS in Produktion verwenden
   - Certbot konfiguriert automatisch HTTPS-Redirect

### Sicherheits-Checkliste

- [ ] JWT_SECRET geändert (64+ Zeichen)
- [ ] Admin-Passwort geändert
- [ ] .env Datei hat Rechte 600 (`chmod 600 .env`)
- [ ] Sudoers-Datei korrekt installiert und getestet
- [ ] Deployment-Skripte gehören root
- [ ] Firewall (ufw) aktiviert
- [ ] Let's Encrypt Zertifikate aktiv
- [ ] Automatische Renewals getestet
- [ ] Logs werden rotiert
- [ ] Backup-Strategie für Datenbank etabliert

## 🧪 Testen des Deployments

### Manueller Test

```bash
# Als viflowapp User
sudo -u viflowapp bash

# Test-ZIP erstellen
mkdir -p /tmp/test-site
echo "<h1>Test Site</h1>" > /tmp/test-site/index.html
cd /tmp
zip -r test-site.zip test-site/

# Upload simulieren
sudo mkdir -p /srv/viflow/uploads/test-slug
sudo cp test-site.zip /srv/viflow/uploads/test-slug/upload.zip
sudo chown viflowapp:viflowapp /srv/viflow/uploads/test-slug/upload.zip

# Deployment-Skript testen (als viflowapp mit sudo)
sudo /opt/viflow/ops/scripts/deploy_site.sh \
  test-slug \
  test.example.com \
  /srv/viflow/uploads/test-slug/upload.zip \
  viewer \
  test123password

# Prüfen
curl -u viewer:test123password http://test.example.com
# oder (wenn DNS nicht zeigt)
curl -u viewer:test123password -H "Host: test.example.com" http://localhost

# Aufräumen
sudo rm -rf /var/www/viflow/test-slug
sudo rm /etc/nginx/sites-enabled/test-slug
sudo rm /etc/nginx/sites-available/test-slug
sudo rm /etc/nginx/htpasswd/htpasswd-test-slug
sudo systemctl stop viflow-test-slug
sudo systemctl disable viflow-test-slug
sudo rm /etc/systemd/system/viflow-test-slug.service
sudo systemctl daemon-reload
sudo systemctl reload nginx
```

## 📊 Monitoring & Logs

### Anwendungs-Logs

```bash
# Backend Logs
sudo journalctl -u viflow-backend -f

# Nginx Access Logs
sudo tail -f /var/log/nginx/access.log

# Nginx Error Logs
sudo tail -f /var/log/nginx/error.log

# Redis Logs
sudo journalctl -u redis-server -f

# Deployment Logs für spezifische Site
sudo journalctl -u viflow-<slug> -f
```

### Deployment Status

Deployment-Logs sind in der Datenbank gespeichert und über die Web-UI einsehbar.

### Datenbank-Backup

```bash
# SQLite Backup
sudo -u viflowapp cp /opt/viflow/apps/backend/dev.db /opt/viflow/backups/backup-$(date +%Y%m%d-%H%M%S).db

# Automatisches Backup via Cron (als viflowapp)
crontab -e
# Fügen Sie hinzu:
# 0 2 * * * cp /opt/viflow/apps/backend/dev.db /opt/viflow/backups/backup-$(date +\%Y\%m\%d).db

# Alte Backups löschen (älter als 30 Tage)
# 0 3 * * * find /opt/viflow/backups -name "backup-*.db" -mtime +30 -delete
```

## 🛠️ Troubleshooting

### Backend startet nicht

```bash
# Logs prüfen
sudo journalctl -u viflow-backend -n 50

# Häufige Probleme:
# - Redis nicht erreichbar: systemctl status redis-server
# - Datenbankfehler: Prisma-Migrationen ausführen
# - JWT_SECRET fehlt: .env prüfen
```

### Deployment schlägt fehl

```bash
# Job-Logs in der Datenbank/UI prüfen
# Häufige Probleme:
# - sudoers nicht korrekt: sudo -u viflowapp sudo -l
# - Skripte nicht ausführbar: ls -la /opt/viflow/ops/scripts/
# - certbot Domain-Validierung: DNS prüfen, A-Record muss auf Server zeigen
```

### Nginx-Konfiguration fehlerhaft

```bash
# Syntax testen
sudo nginx -t

# Nginx neu laden
sudo systemctl reload nginx

# Logs prüfen
sudo tail -f /var/log/nginx/error.log
```

### Let's Encrypt Zertifikat-Fehler

```bash
# Certbot Logs prüfen
sudo journalctl -u certbot -n 50

# Häufige Probleme:
# - DNS zeigt nicht auf Server (A-Record prüfen)
# - Port 80/443 nicht offen (ufw status, netstat)
# - Rate Limit erreicht (5 Zertifikate pro Woche pro Domain)

# Manueller Certbot-Run
sudo certbot --nginx -d example.com --dry-run
```

### Dateisystem-Berechtigungen

```bash
# Uploads-Verzeichnis
sudo chown -R viflowapp:www-data /srv/viflow
sudo chmod -R 755 /srv/viflow

# Deployment-Verzeichnis
sudo chown -R www-data:www-data /var/www/viflow
sudo chmod 755 /var/www/viflow

# Skripte
sudo chown root:root /opt/viflow/ops/scripts/*.sh
sudo chmod 755 /opt/viflow/ops/scripts/*.sh
```

## 🔄 Updates & Wartung

### Anwendung aktualisieren

```bash
cd /opt/viflow

# Code pullen
sudo -u viflowapp git pull

# Dependencies aktualisieren
sudo -u viflowapp pnpm install

# Migrationen ausführen
sudo -u viflowapp pnpm --filter backend prisma migrate deploy

# Neu bauen
sudo -u viflowapp pnpm -r build

# Service neu starten
sudo systemctl restart viflow-backend
```

### Prisma Schema ändern

```bash
# Schema bearbeiten
nano apps/backend/prisma/schema.prisma

# Migration erstellen
pnpm --filter backend prisma migrate dev --name <migration-name>

# Oder in Produktion:
pnpm --filter backend prisma migrate deploy
```

## 📝 Annahmen & Anpassungen

### ViFlow-Dienst Anpassung

Die Deployment-Skripte enthalten einen **Platzhalter** für den tatsächlichen ViFlow-Startbefehl in der systemd-Unit (`ops/templates/systemd.service.tpl`).

**Wenn Ihr ViFlow-Export einen eigenen Backend-Prozess benötigt:**

Ersetzen Sie in `ops/templates/systemd.service.tpl` die Zeile:

```
ExecStart=/usr/bin/env bash -c 'echo "ViFlow service ${slug} - replace with actual command" && sleep infinity'
```

Mit dem tatsächlichen Startbefehl, z.B.:

```
ExecStart=/usr/bin/node server.js
```

**Wenn Ihr Export nur statische HTML-Dateien enthält:**

Der systemd-Service ist **nicht erforderlich**. Nginx liefert die Dateien direkt aus. Sie können:
- Die Service-Zeile auskommentieren
- Oder den Service-Aufruf in `deploy_site.sh` deaktivieren

### Ports und Bind-Adressen

Wenn der ViFlow-Export auf einem spezifischen Port lauscht (z.B. 3000), erweitern Sie das Nginx-Template:

```nginx
location / {
    proxy_pass http://localhost:3000;  # ViFlow Backend
    # ... proxy headers
}
```

### Weitere Deployment-Targets

Das System ist auf **einen Server** ausgelegt. Für Multi-Server-Deployments erweitern Sie:
- Site-Model um `server_id` oder `ip_address`
- Deployment-Worker für SSH-Ausführung
- Skripte für Remote-Deployment

## 📚 API-Dokumentation

### Authentifizierung

**POST** `/api/auth/login`
```json
{
  "username": "admin",
  "password": "admin123!"
}
```

Response: Setzt `token` Cookie, gibt User zurück.

**POST** `/api/auth/logout`

Löscht Cookie.

**GET** `/api/auth/me`

Gibt aktuellen User zurück (auth required).

### Sites

**GET** `/api/sites` (auth)

Liste aller Sites.

**POST** `/api/sites` (auth, admin)
```json
{
  "name": "Meine Seite",
  "domain": "example.com",
  "description": "Optional",
  "basicAuthPassword": "secure123",
  "basicAuthEnabled": true
}
```

**GET** `/api/sites/:id` (auth)

Site-Details.

**POST** `/api/sites/:id/upload` (auth, admin)

Multipart/form-data mit `file` (ZIP).

**POST** `/api/sites/:id/deploy` (auth, admin)
```json
{
  "basicAuthPassword": "secure123"
}
```

Startet Deployment-Job.

**DELETE** `/api/sites/:id` (auth, admin)

Löscht Site (DB-Eintrag; Dateien/Nginx müssen manuell aufgeräumt werden).

### Deployments

**GET** `/api/deployments?siteId=<id>` (auth)

Liste der Deployments.

**GET** `/api/deployments/:id` (auth)

Deployment-Details.

**GET** `/api/deployments/:id/log` (auth)

Deployment-Logs.

## 📄 Lizenz

(Fügen Sie hier Ihre Lizenz ein)

## 🤝 Contributing

(Fügen Sie hier Contributing-Richtlinien ein)

## 📞 Support

Bei Fragen oder Problemen:
- GitHub Issues: (Ihr Repo)
- E-Mail: (Ihre Kontaktadresse)

---

**Entwickelt mit ❤️ für sichere und automatisierte ViFlow-Deployments**
