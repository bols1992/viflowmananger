# ViFlow Deployment Scripts

Dieses Verzeichnis enthält alle Skripte und Templates für das automatisierte Deployment von ViFlow-Instanzen auf Linux-Servern.

## Verzeichnisstruktur

```
ops/
├── scripts/              # Bash-Skripte für Deployment
│   ├── deploy_site.sh    # Master-Deployment-Skript
│   ├── nginx_site.sh     # Nginx-Konfiguration
│   └── systemd_service.sh # systemd Service-Setup
├── templates/            # Konfigurationsvorlagen
│   ├── nginx-site.conf.tpl    # Nginx Server Block
│   └── systemd.service.tpl     # systemd Unit File
└── sudoers.d/
    └── viflow-deployer   # Sudoers-Konfiguration
```

## Skript-Übersicht

### deploy_site.sh

**Hauptskript** für das Deployment einer ViFlow-Site.

**Aufruf**:
```bash
sudo /opt/viflow/ops/scripts/deploy_site.sh \
  <slug> \
  <domain> \
  <zipPath> \
  <basicAuthUser> \
  <basicAuthPassword>
```

**Parameter**:
- `slug`: URL-sicherer Identifier (z.B. `my-site`)
- `domain`: FQDN (z.B. `example.com`)
- `zipPath`: Absoluter Pfad zur ZIP-Datei
- `basicAuthUser`: Username für Basic Auth
- `basicAuthPassword`: Passwort (wird gehashed)

**Aufgaben**:
1. Input-Validierung (Regex)
2. ZIP-Extraktion mit Sicherheitschecks
3. Atomischer Swap (Temp → Current)
4. Permissions setzen (www-data:www-data)
5. Nginx-Konfiguration erstellen (→ nginx_site.sh)
6. Nginx testen und reloaden
7. systemd Service erstellen (→ systemd_service.sh)
8. Let's Encrypt Zertifikat beantragen (certbot)
9. Finale Nginx reload

**Exit Codes**:
- `0`: Erfolg
- `1`: Validierungsfehler, ZIP-Fehler, Nginx-Fehler
- `>1`: Script-interner Fehler

**Logs**: Stdout/Stderr, wird von BullMQ Worker erfasst

**Sicherheit**:
- Validiert alle Inputs mit Regex
- Prüft auf Path-Traversal (`..`, symlinks)
- Limitiert Dateianzahl (10.000)
- Atomische Operationen (keine Downtime)

---

### nginx_site.sh

Erstellt und aktiviert Nginx-Konfiguration für eine Site.

**Aufruf**:
```bash
sudo /opt/viflow/ops/scripts/nginx_site.sh \
  <slug> \
  <domain> \
  <basicAuthUser> \
  <basicAuthPassword>
```

**Aufgaben**:
1. Installiert `htpasswd` falls nötig
2. Erstellt htpasswd-Datei mit bcrypt
3. Generiert Nginx-Config aus Template
4. Aktiviert Site (symlink)
5. Testet Nginx-Konfiguration

**Dateien**:
- `/etc/nginx/sites-available/<slug>` - Config
- `/etc/nginx/sites-enabled/<slug>` - Symlink
- `/etc/nginx/htpasswd/htpasswd-<slug>` - Basic Auth

**Template**: `ops/templates/nginx-site.conf.tpl`

---

### systemd_service.sh

Erstellt systemd-Unit für ViFlow-Backend-Prozess (optional).

**Aufruf**:
```bash
sudo /opt/viflow/ops/scripts/systemd_service.sh <slug>
```

**Aufgaben**:
1. Generiert systemd Unit aus Template
2. Lädt systemd daemon neu
3. Aktiviert und startet Service
4. Prüft Status

**Datei**: `/etc/systemd/system/viflow-<slug>.service`

**Template**: `ops/templates/systemd.service.tpl`

**Hinweis**: Für **statische HTML-only** Sites ist dieser Service nicht erforderlich (Nginx liefert Dateien direkt).

---

## Templates

### nginx-site.conf.tpl

Nginx Server Block Template mit Platzhaltern:
- `${domain}` - Server Name
- `${slug}` - Identifier für Pfade

**Features**:
- HTTP (Port 80) - Certbot fügt HTTPS hinzu
- Basic Authentication
- Security Headers
- Static Asset Caching
- Try Files mit index.html Fallback

### systemd.service.tpl

systemd Unit Template mit Platzhalter `${slug}`.

**Platzhalter-ExecStart**: Muss durch tatsächlichen ViFlow-Startbefehl ersetzt werden.

**Beispiele**:
```ini
# Node.js App
ExecStart=/usr/bin/node server.js

# Python App
ExecStart=/usr/bin/python3 app.py

# Static only
# Kein Service nötig, Kommentar/Deaktivieren
```

---

## Sudoers-Konfiguration

Die Datei `ops/sudoers.d/viflow-deployer` muss nach `/etc/sudoers.d/` kopiert werden.

**Installation**:
```bash
sudo cp /opt/viflow/ops/sudoers.d/viflow-deployer /etc/sudoers.d/viflow-deployer
sudo chmod 440 /etc/sudoers.d/viflow-deployer
sudo visudo -c  # Syntax-Check!
```

**Erlaubte Befehle**:
- Deployment-Skripte in `/opt/viflow/ops/scripts/`
- `nginx -t`, `systemctl reload nginx`
- `systemctl` für viflow-* Services
- `certbot`
- Minimal File-System-Operationen

**Sicherheit**:
- Keine Shell-Escape-Möglichkeiten
- Logs via syslog: `sudo journalctl SYSLOG_IDENTIFIER=sudo`

---

## Deployment-Flow

```
1. User uploaded ZIP via Web-UI
   ↓
2. Backend speichert nach /srv/viflow/uploads/<slug>/upload.zip
   ↓
3. User klickt "Deploy"
   ↓
4. Backend erstellt Deployment-Record (Status: QUEUED)
   ↓
5. BullMQ Worker picked Job
   ↓
6. Worker ruft deploy_site.sh via sudo
   ↓
7. deploy_site.sh:
   - Extrahiert ZIP sicher
   - Ruft nginx_site.sh
   - Ruft systemd_service.sh
   - Fordert TLS-Zertifikat an
   ↓
8. Worker updated Deployment-Status (SUCCESS/FAILED)
   ↓
9. User sieht Live-Logs in Web-UI
```

---

## Manuelles Testen

```bash
# Als viflowapp User
sudo -u viflowapp bash

# Test-Site erstellen
mkdir -p /tmp/test-viflow
echo "<h1>Test</h1>" > /tmp/test-viflow/index.html
cd /tmp && zip -r test.zip test-viflow/

# Upload simulieren
sudo mkdir -p /srv/viflow/uploads/testslug
sudo cp test.zip /srv/viflow/uploads/testslug/upload.zip

# Deployment ausführen
sudo /opt/viflow/ops/scripts/deploy_site.sh \
  testslug \
  test.local.example.com \
  /srv/viflow/uploads/testslug/upload.zip \
  viewer \
  testpass123

# Testen
curl -u viewer:testpass123 http://test.local.example.com
# oder mit Host Header:
curl -u viewer:testpass123 -H "Host: test.local.example.com" http://localhost
```

---

## Troubleshooting

### Skript schlägt fehl: "Permission denied"

```bash
# Skripte ausführbar machen
sudo chmod +x /opt/viflow/ops/scripts/*.sh

# Ownership prüfen
ls -la /opt/viflow/ops/scripts/
# Sollte: root root
```

### Sudo funktioniert nicht

```bash
# Als viflowapp testen
sudo -u viflowapp sudo -l
# Sollte erlaubte Befehle auflisten

# Sudoers Syntax prüfen
sudo visudo -c

# Sudo-Logs prüfen
sudo journalctl SYSLOG_IDENTIFIER=sudo -n 50
```

### Nginx-Config fehlerhaft

```bash
# Manuelle Generierung testen
sed -e "s/\${domain}/test.example.com/g" \
    -e "s/\${slug}/testslug/g" \
    /opt/viflow/ops/templates/nginx-site.conf.tpl

# Syntax-Test
sudo nginx -t
```

### Certbot schlägt fehl

```bash
# Häufige Ursachen:
# 1. DNS zeigt nicht auf Server
nslookup example.com

# 2. Port 80 nicht offen
sudo ufw status
sudo netstat -tlnp | grep :80

# 3. Rate Limit
# → Staging nutzen: certbot --staging

# Manuelle Ausführung
sudo certbot --nginx -d example.com --dry-run
```

### systemd Service startet nicht

```bash
# Status prüfen
sudo systemctl status viflow-<slug>

# Logs
sudo journalctl -u viflow-<slug> -n 50

# Häufig: ExecStart ist Platzhalter
# → Template anpassen!
```

---

## Best Practices

1. **Idempotenz**: Alle Skripte können mehrfach ausgeführt werden ohne Schaden
2. **Logging**: Jede Aktion wird geloggt (Timestamp, Aktion)
3. **Error Handling**: `set -euo pipefail` in allen Skripten
4. **Atomicity**: Deployments nutzen Temp→Current Swap
5. **Backups**: Alte Versionen werden automatisch gesichert (letzte 3)
6. **Validierung**: Jeder Input wird vor Verwendung validiert

---

## Erweiterungen

### Custom Nginx-Config

Erweitern Sie `nginx-site.conf.tpl` für:
- Proxy zu Backend-Prozess (wenn nicht statisch)
- Custom Headers
- Redirects
- Rate Limiting pro Site

Beispiel (Proxy):
```nginx
location /api {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### Multi-Server Deployment

Für Deployments auf mehreren Servern:
1. SSH-Keys zwischen Servern einrichten
2. Skripte um `ssh user@target-server` erweitern
3. Deployment-Record um `server_id` erweitern

### Custom systemd Units

Für spezifische ViFlow-Versionen Template anpassen:
- Environment Variables
- Resource Limits (CPU, Memory)
- Dependencies (After=postgresql.service)

---

**Letzte Aktualisierung**: 2025-01-XX
