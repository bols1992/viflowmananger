# Contributing to ViFlow Manager

Vielen Dank für Ihr Interesse, zu ViFlow Manager beizutragen!

## 🐛 Bug Reports

Bitte öffnen Sie ein GitHub Issue mit:
- Beschreibung des Problems
- Schritte zur Reproduktion
- Erwartetes vs. tatsächliches Verhalten
- Umgebung (OS, Node-Version, etc.)
- Logs (falls relevant)

## 💡 Feature Requests

Feature-Vorschläge sind willkommen! Bitte:
- Beschreiben Sie den Use Case
- Erklären Sie, warum das Feature wertvoll ist
- Skizzieren Sie mögliche Implementierungen

## 🔧 Pull Requests

1. **Fork** das Repository
2. **Branch** erstellen (`git checkout -b feature/mein-feature`)
3. **Code** schreiben und testen
4. **Commit** mit aussagekräftiger Message
5. **Push** und PR öffnen

### Code-Stil

- TypeScript strict mode
- ESLint + Prettier (automatisch via `pnpm format`)
- Aussagekräftige Variablennamen
- Kommentare für komplexe Logik
- Security-relevante Stellen markieren

### Tests

- Unit-Tests für neue Funktionen
- Sicherheits-Tests für Input-Validierung
- E2E-Tests für kritische Flows (optional)

### Commit Messages

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Beispiele:
```
feat(backend): add PostgreSQL support
fix(security): prevent path traversal in ZIP extraction
docs(readme): improve deployment instructions
```

## 🔒 Security

**Sicherheitslücken NICHT öffentlich melden!**

Kontakt: security@yourdomain.com (ersetzen)

## 📝 Dokumentation

- README.md für Hauptdokumentation
- Inline-Kommentare für Code
- JSDoc für öffentliche APIs
- ops/README.md für Deployment-Skripte

## ⚖️ Lizenz

Beiträge werden unter der MIT-Lizenz veröffentlicht.
