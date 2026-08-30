const express = require('express');
const db = require('../Controller/db');

const router = express.Router();

async function query(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}

// GET /api/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const [admins, utilisateurs, messages] = await Promise.all([
            query('SELECT COUNT(*) AS total FROM admin'),
            query('SELECT COUNT(*) AS total FROM utilisateur'),
            query('SELECT COUNT(*) AS total FROM message')
        ]);

        res.json({
            admins: admins[0].total,
            utilisateurs: utilisateurs[0].total,
            messages: messages[0].total
        });
    } catch (err) {
        console.error('Error loading dashboard stats:', err);
        res.status(500).json({
            error: 'Erreur lors du chargement des statistiques'
        });
    }
});

module.exports = router;