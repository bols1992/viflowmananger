# Security Policy

## Sicherheitsarchitektur

### Authentifizierung & Authorization

- **JWT-Tokens**: Gespeichert in httpOnly Cookies (XSS-Schutz)
- **SameSite=Lax**: CSRF-Schutz durch Browser-Policy
- **Argon2**: Sichere Passwort-Hashing-Algorithmus
- **Role-Based Access**: Admin/User Rollen

### Upload-Sicherheit

1. **Dateityp-Validierung**:
   - MIME-Type Check
   - Magic Bytes Validation (ZIP Signature)
   - Nur `.zip` Dateien erlaubt

2. **Path Traversal Prevention**:
   - Keine `..` in Pfaden erlaubt
   - Keine absoluten Pfade
   - Keine Symlinks
   - Regex-basierte Slug-Validierung

3. **Resource Limits**:
   - Max. Dateigröße: 2GB (konfigurierbar)
   - Max. Dateianzahl pro ZIP: 10.000
   - Max. entpackte Größe: 5GB

4. **Isolation**:
   - Uploads in separates Verzeichnis
   - Temp-Extraktion mit atomischem Move
   - Backups alter Versionen

### Sudo-Ausführung

**Konzept**: Der Backend-Prozess läuft als unprivilegierter User (`viflowapp`) und führt nur whitelistete Skripte via sudo aus.

**Sicherheitsmaßnahmen**:
- Skripte gehören root und sind nicht modifizierbar durch viflowapp
- Sudoers-Datei erlaubt nur spezifische Befehle (keine Shell-Escape)
- Alle Skripte validieren Inputs mit Regex
- Logging aller sudo-Aufrufe

**Whitelisted Commands**:
- `/opt/viflow/ops/scripts/*.sh`
- `nginx -t`, `systemctl reload nginx`
- `systemctl` für viflow-* Services
- `certbot` für TLS-Zertifikate
- Minimale File-System-Operationen

### Nginx Basic Auth

- Passwörter mit bcrypt gehashed (`htpasswd -B`)
- htpasswd-Dateien: 640 Rechte, root:www-data
- Separate htpasswd-Datei pro Site

### Rate Limiting

```javascript
Login: 5 Versuche / 15 Minuten / IP
API: 100 Requests / 15 Minuten / IP
```

### CORS

- Strict Origin Whitelist
- Credentials: true (für Cookies)
- Keine Wildcards in Produktion

### Headers (via Helmet)

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
```

### TLS/HTTPS

- Let's Encrypt Zertifikate
- Automatische HTTP→HTTPS Redirect
- HSTS Header (via Nginx)

## Bekannte Einschränkungen

### 1. Sudo-basiertes Deployment

**Risiko**: Ein Fehler in den Deployment-Skripten könnte zu Privilege-Escalation führen.

**Mitigation**:
- Skripte ausführlich getestet
- Input-Validierung in jedem Skript
- Logging aller Aktionen
- Regelmäßige Audits der Skripte

**Alternative**: Ansible/Salt/Chef für komplexere Setups.

### 2. Shared Server

Das System ist für **dedizierten Server** konzipiert. Auf Shared Hosting mit anderen Anwendungen:
- Namespace-Konflikte möglich (Nginx, systemd)
- Erhöhtes Risiko bei Privilege-Escalation

**Empfehlung**: Dedizierter Server oder separate VM pro ViFlow-Manager-Instanz.

### 3. ZIP-Bomb Protection

**Limitiert**: Dateianzahl und Größe werden geprüft, aber keine Kompressions-Ratio-Analyse.

**Mitigation**: Timeout für unzip-Prozess (implizit via script timeout).

### 4. DoS via Upload

**Risiko**: Mehrere große Uploads könnten Disk füllen.

**Mitigation**:
- Upload-Größenlimit
- Disk Space Monitoring empfohlen
- Optional: Quota für /srv/viflow

### 5. Let's Encrypt Rate Limits

5 Zertifikate pro Woche pro Domain. Bei vielen Test-Deployments kann Limit erreicht werden.

**Mitigation**: Staging-Environment von Let's Encrypt nutzen für Tests.

## Reporting Security Issues

**Bitte KEINE öffentlichen GitHub Issues für Sicherheitslücken.**

Kontaktieren Sie:
- E-Mail: security@yourdomain.com (ersetzen)
- PGP Key: (optional einfügen)

Wir werden innerhalb von 48 Stunden antworten.

## Security Checklist für Deployment

- [ ] JWT_SECRET mit 64+ zufälligen Zeichen generiert
- [ ] Admin-Passwort geändert (nicht `admin123!`)
- [ ] `.env` Datei Rechte: 600
- [ ] Sudoers-Datei korrekt installiert und Syntax-Check (`visudo -c`)
- [ ] Deployment-Skripte gehören root:root
- [ ] Firewall aktiviert (ufw)
- [ ] SSH: Key-basierte Auth, kein Root-Login
- [ ] Fail2ban installiert (optional, empfohlen)
- [ ] HTTPS aktiv, HTTP→HTTPS Redirect
- [ ] Certbot Auto-Renewal getestet
- [ ] Monitoring für Disk Space eingerichtet
- [ ] Backup-Strategie etabliert
- [ ] Logs werden rotiert (logrotate)
- [ ] Security Updates automatisch (unattended-upgrades)

## Empfohlene Zusatz-Sicherheit

### 1. Fail2ban

```bash
sudo apt-get install fail2ban

# /etc/fail2ban/jail.local
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[sshd]
enabled = true
```

### 2. Auditd

```bash
sudo apt-get install auditd
sudo systemctl enable auditd

# Überwachen von sudo-Aufrufen
sudo auditctl -w /usr/bin/sudo -p x -k sudo_exec
```

### 3. AppArmor/SELinux

Für fortgeschrittene Isolation der Anwendung.

### 4. Intrusion Detection (OSSEC/Wazuh)

Für Enterprise-Deployments.

### 5. Secret Management (Vault)

Für JWT_SECRET und andere Secrets statt .env-Datei.

## Security Updates

```bash
# Automatische Security Updates
sudo apt-get install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Incident Response

Bei Sicherheitsvorfall:

1. Backend stoppen: `sudo systemctl stop viflow-backend`
2. Logs sichern: `sudo journalctl -u viflow-backend > incident.log`
3. Nginx Logs sichern: `sudo tar czf nginx-logs.tar.gz /var/log/nginx/`
4. Datenbank-Backup: `cp dev.db incident-backup.db`
5. Analyse mit Timestamps
6. Betroffene Nutzer informieren (DSGVO)
7. JWT_SECRET rotieren (alle Sessions invalidiert)
8. Alle Passwörter zurücksetzen

---

**Last Updated**: 2025-01-XX
