import express from 'express';
import session from 'express-session';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || 'changeme';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001';
const SESSION_SECRET = process.env.SESSION_SECRET || 'viflow-secret-' + Math.random();
const SITE_NAME = process.env.SITE_NAME || 'ViFlow Site';
const SITE_ID = process.env.SITE_ID || '';
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/opt/viflowapp/data/uploads';

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

// Serve logo - dynamic (custom or default)
app.get('/logo.png', (req, res) => {
  // Try to serve custom logo first
  if (SITE_ID) {
    const customLogoDir = path.join(UPLOAD_DIR, SITE_ID, 'logo');

    // Try different extensions
    const extensions = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
    for (const ext of extensions) {
      const customLogoPath = path.join(customLogoDir, 'logo' + ext);
      if (fs.existsSync(customLogoPath)) {
        return res.sendFile(customLogoPath);
      }
    }
  }

  // Fallback to default logo
  res.sendFile('/app/logo.png');
});

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
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #6366f1 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      position: relative;
      overflow: hidden;
    }
    body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url('data:image/svg+xml,<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="2" fill="white" opacity="0.1"/></svg>');
      animation: float 20s linear infinite;
    }
    @keyframes float {
      0% { transform: translateY(0); }
      100% { transform: translateY(-100px); }
    }
    .login-container {
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(10px);
      border-radius: 24px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      max-width: 440px;
      width: 100%;
      padding: 0;
      overflow: hidden;
      position: relative;
      z-index: 1;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .header {
      background: linear-gradient(135deg, #0ea5e9, #3b82f6);
      padding: 40px 40px 30px;
      text-align: center;
      position: relative;
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: -20px;
      left: 50%;
      transform: translateX(-50%);
      width: 40px;
      height: 40px;
      background: white;
      border-radius: 50%;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .logo-img {
      max-width: 80px;
      height: auto;
      margin-bottom: 16px;
      filter: brightness(0) invert(1);
    }
    .header h1 {
      color: white;
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header p {
      color: rgba(255, 255, 255, 0.9);
      font-size: 15px;
      font-weight: 500;
    }
    .content {
      padding: 50px 40px 40px;
    }
    .form-group {
      margin-bottom: 24px;
    }
    label {
      display: block;
      color: #1f2937;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .input-wrapper {
      position: relative;
    }
    .input-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: #9ca3af;
      font-size: 18px;
    }
    input[type="password"] {
      width: 100%;
      padding: 14px 16px 14px 46px;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      font-size: 16px;
      transition: all 0.3s ease;
      background: #f9fafb;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: #3b82f6;
      background: white;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
    }
    .btn {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      position: relative;
      overflow: hidden;
    }
    .btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.5s;
    }
    .btn:hover::before {
      left: 100%;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(59, 130, 246, 0.5);
    }
    .btn:active {
      transform: translateY(0);
    }
    .error {
      background: linear-gradient(135deg, #fef2f2, #fee2e2);
      color: #dc2626;
      padding: 14px 18px;
      border-radius: 12px;
      margin-bottom: 24px;
      font-size: 14px;
      border-left: 4px solid #dc2626;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: shake 0.5s;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-10px); }
      75% { transform: translateX(10px); }
    }
    .footer {
      background: #f9fafb;
      padding: 24px 40px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer-content {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.8;
    }
    .footer a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s;
    }
    .footer a:hover {
      color: #2563eb;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="header">
      <img src="/logo.png" alt="pro-HT Logo" class="logo-img">
      <h1>${SITE_NAME}</h1>
      <p>Geschützter Bereich</p>
    </div>

    <div class="content">
      ${error ? '<div class="error"><span>⚠️</span> <span>Falsches Passwort. Bitte versuchen Sie es erneut.</span></div>' : ''}

      <form method="POST" action="/login">
        <div class="form-group">
          <label for="password">Passwort eingeben</label>
          <div class="input-wrapper">
            <span class="input-icon">🔒</span>
            <input
              type="password"
              id="password"
              name="password"
              required
              autofocus
              placeholder="••••••••"
            >
          </div>
        </div>

        <button type="submit" class="btn">
          Anmelden →
        </button>
      </form>
    </div>

    <div class="footer">
      <div class="footer-content">
        Entwickelt von <a href="https://proht.de" target="_blank">pro-HT</a><br>
        <a href="mailto:info@proht.de">info@proht.de</a>
      </div>
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
