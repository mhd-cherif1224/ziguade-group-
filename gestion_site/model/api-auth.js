const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../Controller/db');

const router = express.Router();

async function query(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}

// POST /api/register
router.post('/register', async (req, res) => {
  try {
    const { nom, prenom, username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis" });
    }

    const existing = await query('SELECT id FROM admin WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Ce nom d'utilisateur existe déjà" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await query(
      'INSERT INTO admin (nom, prenom, username, password) VALUES (?, ?, ?, ?)',
      [nom || null, prenom || null, username, hashedPassword]
    );

    res.status(201).json({ message: 'Administrateur créé avec succès' });
  } catch (err) {
    console.error('Erreur register:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/login
router.post("/login", async (req, res) => {

    const { username, password } = req.body;

    try {

        // ===== ADMIN =====
        const [admins] = await db.query(
            "SELECT * FROM admin WHERE username = ?",
            [username]
        );

        if (admins.length > 0) {

            const admin = admins[0];

            const match = await bcrypt.compare(password, admin.password);

            if (!match) {
                return res.status(401).json({
                    success: false,
                    error: "Mot de passe incorrect."
                });
            }

            const token = jwt.sign(
                {
                    id: admin.id,
                    role: "admin"
                },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

            return res.json({
                success: true,
                message: "Connexion administrateur réussie.",
                role: "admin",
                token
            });

        }

        // ===== UTILISATEUR =====
            const [users] = await db.query(
                "SELECT * FROM utilisateur WHERE username = ?",
                [username]
            );

            if (users.length > 0) {

                const user = users[0];

                // Plain-text comparison
                if (user.password !== password) {
                    return res.status(401).json({
                        success: false,
                        error: "Mot de passe incorrect."
                    });
                }

                const token = jwt.sign(
                    {
                        id: user.id,
                        role: "utilisateur"
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: "1d" }
                );

                return res.json({
                    success: true,
                    message: "Connexion utilisateur réussie.",
                    role: "utilisateur",
                    token
                });

            }

        return res.status(401).json({
            success: false,
            error: "Nom d'utilisateur introuvable."
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            error: "Erreur serveur."
        });

    }

});

// POST /api/logout
// Nothing to clear server-side anymore — logout is purely client-side
// (remove the token from localStorage). Route kept for compatibility.
router.post('/logout', (req, res) => {
  res.json({ message: 'Déconnecté' });
});

module.exports = router;