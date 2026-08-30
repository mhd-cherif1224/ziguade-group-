const express = require('express');
const db = require('../Controller/db');

const router = express.Router();

async function query(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}

async function getUtilisateurs() {
  const rows = await query(
    'SELECT id, nom, prenom, username FROM utilisateur ORDER BY id DESC'
  );

  return rows.map((row) => ({
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    username: row.username
  }));
}

async function getUtilisateurById(id) {
  const rows = await query(
    'SELECT id, nom, prenom, username FROM utilisateur WHERE id = ?',
    [id]
  );

  return rows[0] || null;
}

async function createUtilisateur({ nom, prenom, username, password }) {
  const result = await query(
    'INSERT INTO utilisateur (nom, prenom, username, password) VALUES (?, ?, ?, ?)',
    [nom, prenom, username, password]
  );

  return {
    id: result.insertId,
    nom,
    prenom,
    username
  };
}

async function updateUtilisateur(id, { nom, prenom, username, password }) {
  if (password) {
    await query(
      'UPDATE utilisateur SET nom = ?, prenom = ?, username = ?, password = ? WHERE id = ?',
      [nom, prenom, username, password, id]
    );
  } else {
    await query(
      'UPDATE utilisateur SET nom = ?, prenom = ?, username = ? WHERE id = ?',
      [nom, prenom, username, id]
    );
  }

  return getUtilisateurById(id);
}

async function deleteUtilisateur(id) {
  await query(
    'DELETE FROM utilisateur WHERE id = ?',
    [id]
  );
}

// GET /api/utilisateurs
router.get('/utilisateurs', async (req, res) => {
  try {
    const utilisateurs = await getUtilisateurs();
    res.json(utilisateurs);
  } catch (err) {
    console.error('Error fetching utilisateurs:', err);
    res.status(500).json({
      error: 'Erreur lors de la récupération des utilisateurs'
    });
  }
});

// GET /api/utilisateurs/:id
router.get('/utilisateurs/:id', async (req, res) => {
  try {
    const utilisateur = await getUtilisateurById(req.params.id);

    if (!utilisateur) {
      return res.status(404).json({
        error: 'Utilisateur introuvable'
      });
    }

    res.json(utilisateur);
  } catch (err) {
    console.error('Error fetching utilisateur:', err);
    res.status(500).json({
      error: "Erreur lors de la récupération de l'utilisateur"
    });
  }
});

// POST /api/utilisateurs
router.post('/utilisateurs', async (req, res) => {
  try {
    const { nom, prenom, username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Les champs "username" et "password" sont requis'
      });
    }

    const utilisateur = await createUtilisateur({
      nom,
      prenom,
      username,
      password
    });

    res.status(201).json(utilisateur);
  } catch (err) {
    console.error('Error creating utilisateur:', err);
    res.status(500).json({
      error: "Erreur lors de la création de l'utilisateur"
    });
  }
});

// PUT /api/utilisateurs/:id
router.put('/utilisateurs/:id', async (req, res) => {
  try {
    const { nom, prenom, username, password } = req.body;

    const existing = await getUtilisateurById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        error: 'Utilisateur introuvable'
      });
    }

    const utilisateur = await updateUtilisateur(req.params.id, {
      nom,
      prenom,
      username,
      password
    });

    res.json(utilisateur);
  } catch (err) {
    console.error('Error updating utilisateur:', err);
    res.status(500).json({
      error: "Erreur lors de la mise à jour de l'utilisateur"
    });
  }
});

// DELETE /api/utilisateurs/:id
router.delete('/utilisateurs/:id', async (req, res) => {
  try {
    const existing = await getUtilisateurById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        error: 'Utilisateur introuvable'
      });
    }

    await deleteUtilisateur(req.params.id);
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting utilisateur:', err);
    res.status(500).json({
      error: "Erreur lors de la suppression de l'utilisateur"
    });
  }
});

module.exports = router;