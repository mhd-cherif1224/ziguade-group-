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


// =========================
// Middleware
// =========================

app.use(express.json());
app.use(cookieParser());


// =========================
// Static files
// gestion_site/view/
// =========================

app.use(
    express.static(
        path.join(__dirname, 'view')
    )
);


// =========================
// API
// =========================

app.use('/api', apiAuthRouter);
app.use('/api', apiRouter);
app.use('/api', apiAdminRouter);
app.use('/api', apiUtilisateurRouter);
app.use('/api', apidashboard);
app.use('/api', apiClientRouter);
app.use('/api', webhookRouter);


// =========================
// Uploads
// gestion_site/uploads/
// =========================

app.use(
    '/uploads',
    express.static(
        path.join(__dirname, 'uploads')
    )
);


// =========================
// Main website
// main_site/front-end/
// =========================

const mainSitePath = path.join(
    __dirname,
    '../html/main_site/front-end'
);

app.use(
    '/main',
    express.static(mainSitePath)
);

console.log('Main site path:', mainSitePath);


// =========================
// GET /api/me
// =========================

app.get('/api/me', authenticateToken, (req, res) => {
    res.json({
        admin: req.user
    });
});


// =========================
// Authentication
// =========================

function requirePageAuth(req, res, next) {

    const token = req.cookies?.token;

    if (!token) {
        return res.redirect('/html/login-admin.html');
    }

    jwt.verify(
        token,
        process.env.JWT_SECRET,
        (err) => {

            if (err) {
                return res.redirect('/html/login-admin.html');
            }

            next();
        }
    );
}


// =========================
// Admin dashboard
// =========================

app.get('/', requirePageAuth, (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            'view',
            'html',
            'admin-dashboard.html'
        )
    );

});


// =========================
// Start server
// =========================

app.listen(PORT, '0.0.0.0', () => {

    console.log(
        `Gestion site server running at http://localhost:${PORT}`
    );

});