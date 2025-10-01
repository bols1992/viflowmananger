# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
und dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/).

## [1.0.0] - 2025-01-XX

### Added

**Backend**:
- Express + TypeScript Backend mit Prisma ORM
- JWT-basierte Authentifizierung mit httpOnly Cookies
- Argon2 Passwort-Hashing
- BullMQ Job Queue für asynchrone Deployments
- Rate Limiting und CORS-Schutz
- Comprehensive Input-Validierung mit Zod
- Pino Structured Logging
- Site-Verwaltung (CRUD)
- Deployment-Management mit Live-Logs

**Frontend**:
- React 18 + TypeScript + Vite
- TailwindCSS für Styling
- React Router für Navigation
- React Hook Form + Zod für Formulare
- Axios für API-Calls
- Site-Liste, Site-Detail, Upload, Deployment-Logs
- Echtzeit-Upload-Fortschritt
- Auto-Refresh für Deployment-Status

**Deployment**:
- Automatische ZIP-Extraktion mit Sicherheitschecks
- Nginx-Konfiguration mit Basic Auth
- Let's Encrypt TLS-Zertifikate via certbot
- systemd Service-Management
- Sudo-basierte Skript-Ausführung
- Idempotente Bash-Skripte
- Atomisches Deployment (zero-downtime)

**Sicherheit**:
- Path Traversal Prevention
- ZIP Bomb Protection (Limits)
- Sudoers-Whitelist für privilegierte Operationen
- Security Headers (Helmet)
- CSRF-Schutz via SameSite Cookies
- Rate Limiting (Login + API)
- Input Sanitization

**DevOps**:
- Docker Compose für Redis
- pnpm Workspaces Monorepo
- Prisma Migrations
- Development Scripts (dev.sh, migrate.sh)
- Comprehensive README & Dokumentation

### Security

- JWT Secret validation (min. 32 chars)
- Argon2 für Passwörter
- Nginx Basic Auth mit bcrypt
- File upload validation (magic bytes)
- Sudoers mit minimal permissions
- No root execution of untrusted code

---

## [Unreleased]

### Planned

- PostgreSQL Support (über SQLite hinaus)
- Multi-User Management (User CRUD)
- Site Analytics/Metrics
- Webhook-Benachrichtigungen
- Custom Domain Validation
- Backup/Restore UI
- Deployment Rollback
- Multi-Server Support

### Under Consideration

- GraphQL API
- WebSocket für Live-Updates
- Internationalisierung (i18n)
- Dark Mode
- Mobile App
- Docker Container Deployment (statt ZIP)

---

**Legende**:
- `Added`: Neue Features
- `Changed`: Änderungen an existierender Funktionalität
- `Deprecated`: Bald zu entfernende Features
- `Removed`: Entfernte Features
- `Fixed`: Bug Fixes
- `Security`: Sicherheitsverbesserungen
