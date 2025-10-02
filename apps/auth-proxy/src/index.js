import express from 'express';
import session from 'express-session';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cookieParser from 'cookie-parser';

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'changeme';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';
const SESSION_SECRET = process.env.SESSION_SECRET || 'viflow-secret-' + Math.random();
const SITE_NAME = process.env.SITE_NAME || 'ViFlow Site';

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: false, // Set to true if using HTTPS
  }
}));

// Auth middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.redirect('/login');
};

// Login page
app.get('/login', (req, res) => {
  const error = req.query.error;
  res.send(`
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - ${SITE_NAME}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .login-container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 420px;
      width: 100%;
      padding: 40px;
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo h1 {
      color: #667eea;
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .logo p {
      color: #6b7280;
      font-size: 14px;
    }
    .form-group {
      margin-bottom: 24px;
    }
    label {
      display: block;
      color: #374151;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    input[type="password"] {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 16px;
      transition: all 0.2s;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    .btn {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }
    .btn:active {
      transform: translateY(0);
    }
    .error {
      background: #fef2f2;
      color: #991b1b;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
      border-left: 4px solid #dc2626;
    }
    .footer {
      margin-top: 30px;
      text-align: center;
      font-size: 13px;
      color: #6b7280;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="logo">
      <h1>🔐 ${SITE_NAME}</h1>
      <p>Bitte geben Sie das Passwort ein</p>
    </div>

    ${error ? '<div class="error">❌ Falsches Passwort. Bitte versuchen Sie es erneut.</div>' : ''}

    <form method="POST" action="/login">
      <div class="form-group">
        <label for="password">Passwort</label>
        <input
          type="password"
          id="password"
          name="password"
          required
          autofocus
          placeholder="Passwort eingeben"
        >
      </div>

      <button type="submit" class="btn">
        Anmelden
      </button>
    </form>

    <div class="footer">
      Erstellt von <a href="https://proht.de" target="_blank">pro-HT</a><br>
      <small>Kontakt: <a href="mailto:info@proht.de">info@proht.de</a></small>
    </div>
  </div>
</body>
</html>
  `);
});

// Login handler
app.post('/login', (req, res) => {
  const { password } = req.body;

  if (password === AUTH_PASSWORD) {
    req.session.authenticated = true;
    res.redirect('/');
  } else {
    res.redirect('/login?error=1');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Proxy all other requests to backend
app.use('/', requireAuth, createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  ws: true, // WebSocket support
  onProxyReq: (proxyReq, req) => {
    // Forward original headers
    proxyReq.setHeader('X-Forwarded-For', req.ip);
    proxyReq.setHeader('X-Forwarded-Proto', req.protocol);
    proxyReq.setHeader('X-Forwarded-Host', req.hostname);
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(502).send(`
      <h1>502 Bad Gateway</h1>
      <p>Die Anwendung ist derzeit nicht erreichbar.</p>
    `);
  }
}));

app.listen(PORT, () => {
  console.log(`Auth proxy listening on port ${PORT}`);
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`Site name: ${SITE_NAME}`);
});
