const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
require("./cron/messageAlarm");

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
app.use(cookieParser());

// ------------------------------------------------------------
// Page guard: only serve the dashboard HTML if the token cookie
// is valid. Otherwise, clear any stale cookie and redirect to login.
// ------------------------------------------------------------
function requirePageAuth(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.redirect('/html/login-admin.html');
  }

  jwt.verify(token, process.env.JWT_SECRET, (err) => {
    if (err) {
      res.clearCookie('token');
      return res.redirect('/html/login-admin.html');
    }
    next();
  });
}

// '/' must be registered BEFORE express.static(view), otherwise
// static will serve view/index.html (if present) and bypass auth entirely.
app.get('/', requirePageAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'view', 'html', 'admin-dashboard.html'));
});

app.use(express.static(path.join(__dirname, 'view')));

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

// GET /api/me — lets the frontend check "am I logged in?" and get admin info
app.get('/api/me', authenticateToken, (req, res) => {
  res.json({ admin: req.user });
});

// POST /api/logout — clears the auth cookie
app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Déconnecté avec succès' });
});

// ------------------------------------------------------------
// Static assets
// ------------------------------------------------------------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/main', express.static(path.join(__dirname, 'main-front-end')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Gestion site server running at http://localhost:${PORT}`);
});