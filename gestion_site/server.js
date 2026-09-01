const express = require('express');
const path = require('path');
const compression = require('compression');

const apiRouter = require('./model/api.js');
const apiAdminRouter = require('./model/api-admin');
const apiUtilisateurRouter = require('./model/api-user');
const apidashboard = require('./model/api-dashboard');
const apiAuthRouter = require('./model/api-auth');
const apiClientRouter = require('./model/api-client');
const webhookRouter = require('./model/webhook');

const authenticateToken = require('./Controller/auth-middleware');

const app = express();
const PORT = 3001;

app.use(express.json());

// Basic hardening + compression
app.disable('x-powered-by');
app.use(compression());

// ------------------------------------------------------------
// Static assets — safe to register first now, since page-level
// auth is no longer enforced server-side. The dashboard page loads
// for anyone, but check-auth.js (running in the page) verifies the
// token against /api/me and redirects to login if it's missing/invalid.
// ------------------------------------------------------------
// Serve static assets with a caching policy
app.use(express.static(path.join(__dirname, 'view'), { maxAge: '1d' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '1d' }));
app.use('/main', express.static(path.join(__dirname, 'main-front-end'), { maxAge: '1d' }));

// ------------------------------------------------------------
// API routes
// ------------------------------------------------------------
app.use('/api', apiAuthRouter);
app.use('/api', apiRouter);
app.use('/api', apiAdminRouter);
app.use('/api', apiUtilisateurRouter);
app.use('/api', apidashboard);
app.use('/api', apiClientRouter);
app.use('/api', webhookRouter);

// GET /api/me — the frontend calls this with an Authorization: Bearer <token>
// header to check "am I logged in?" and get admin info.
app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ admin: req.user });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'html', 'login-admin.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gestion site server running at http://localhost:${PORT}`);
});

// Start background cron AFTER the server is listening so startup isn't delayed
require("./cron/messageAlarm");