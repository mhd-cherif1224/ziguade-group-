const express = require('express');
const db = require('../Controller/db');

const router = express.Router();

async function query(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}

async function getAdmins() {
  const rows = await query(
    'SELECT id, nom, prenom, username FROM admin ORDER BY id DESC'
  );

  return rows.map((row) => ({
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    username: row.username
  }));
}

async function getAdminById(id) {
  const rows = await query(
    'SELECT id, nom, prenom, username FROM admin WHERE id = ?',
    [id]
  );

  return rows[0] || null;
}

async function createAdmin({ nom, prenom, username, password }) {
  const result = await query(
    'INSERT INTO admin (`nom`, `prenom`, `username`, `password`) VALUES (?, ?, ?, ?)',
    [nom, prenom, username, password]
  );

  return {
    id: result.insertId,
    nom,
    prenom,
    username
  };
}

async function updateAdmin(id, { nom, prenom, username, password }) {
  if (password) {
    await query(
      'UPDATE admin SET nom = ?, prenom = ?, username = ?, password = ? WHERE id = ?',
      [nom, prenom, username, password, id]
    );
  } else {
    await query(
      'UPDATE admin SET nom = ?, prenom = ?, username = ? WHERE id = ?',
      [nom, prenom, username, id]
    );
  }

  return getAdminById(id);
}

async function deleteAdmin(id) {
  await query('DELETE FROM admin WHERE id = ?', [id]);
}

// GET /api/admins
router.get('/admins', async (req, res) => {
  try {
    const admins = await getAdmins();
    res.json(admins);
  } catch (err) {
    console.error('Error fetching admins:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des admins' });
  }
});

// GET /api/admins/:id
router.get('/admins/:id', async (req, res) => {
  try {
    const admin = await getAdminById(req.params.id);

    if (!admin) {
      res.status(404).json({ error: 'Admin introuvable' });
      return;
    }

    res.json(admin);
  } catch (err) {
    console.error('Error fetching admin:', err);
    res.status(500).json({ error: "Erreur lors de la récupération de l'admin" });
  }
});

// POST /api/admins
router.post('/admins', async (req, res) => {
  try {
    const { nom, prenom, username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Les champs "username" et "password" sont requis' });
      return;
    }

    const admin = await createAdmin({ nom, prenom, username, password });
    res.status(201).json(admin);
  } catch (err) {
    console.error('Error creating admin:', err);
    res.status(500).json({ error: "Erreur lors de la création de l'admin" });
  }
});

// PUT /api/admins/:id
router.put('/admins/:id', async (req, res) => {
  try {
    const { nom, prenom, username, password } = req.body;

    const existing = await getAdminById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Admin introuvable' });
      return;
    }

    const admin = await updateAdmin(req.params.id, { nom, prenom, username, password });
    res.json(admin);
  } catch (err) {
    console.error('Error updating admin:', err);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'admin" });
  }
});

// DELETE /api/admins/:id
router.delete('/admins/:id', async (req, res) => {
  try {
    const existing = await getAdminById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Admin introuvable' });
      return;
    }

    await deleteAdmin(req.params.id);
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting admin:', err);
    res.status(500).json({ error: "Erreur lors de la suppression de l'admin" });
  }
});

module.exports = router;