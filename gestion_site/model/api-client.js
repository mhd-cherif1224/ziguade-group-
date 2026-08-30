const express = require('express');
const db = require('../Controller/db');

const router = express.Router();

async function query(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows;
}

async function getClients() {
  const rows = await query(
    'SELECT id, name, phone FROM clients ORDER BY id DESC'
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone
  }));
}

async function getClientById(id) {
  const rows = await query(
    'SELECT id, name, phone FROM clients WHERE id = ?',
    [id]
  );

  return rows[0] || null;
}

async function createClient({ name, phone }) {
  const result = await query(
    'INSERT INTO clients (`name`, `phone`) VALUES (?, ?)',
    [name, phone]
  );

  return {
    id: result.insertId,
    name,
    phone
  };
}

async function updateClient(id, { name, phone }) {
  await query(
    'UPDATE clients SET name = ?, phone = ? WHERE id = ?',
    [name, phone, id]
  );

  return getClientById(id);
}

async function deleteClient(id) {
  await query('DELETE FROM clients WHERE id = ?', [id]);
}

// GET /api/clients
router.get('/clients', async (req, res) => {
  try {
    const clients = await getClients();
    res.json(clients);
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des clients' });
  }
});

// GET /api/clients/:id
router.get('/clients/:id', async (req, res) => {
  try {
    const client = await getClientById(req.params.id);

    if (!client) {
      res.status(404).json({ error: 'Client introuvable' });
      return;
    }

    res.json(client);
  } catch (err) {
    console.error('Error fetching client:', err);
    res.status(500).json({ error: "Erreur lors de la récupération du client" });
  }
});

// POST /api/clients
router.post('/clients', async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      res.status(400).json({ error: 'Les champs "name" et "phone" sont requis' });
      return;
    }

    const client = await createClient({ name, phone });
    res.status(201).json(client);
  } catch (err) {
    console.error('Error creating client:', err);
    res.status(500).json({ error: "Erreur lors de la création du client" });
  }
});

// PUT /api/clients/:id
router.put('/clients/:id', async (req, res) => {
  try {
    const { name, phone } = req.body;

    const existing = await getClientById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Client introuvable' });
      return;
    }

    const client = await updateClient(req.params.id, { name, phone });
    res.json(client);
  } catch (err) {
    console.error('Error updating client:', err);
    res.status(500).json({ error: "Erreur lors de la mise à jour du client" });
  }
});

// DELETE /api/clients/:id
router.delete('/clients/:id', async (req, res) => {
  try {
    const existing = await getClientById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Client introuvable' });
      return;
    }

    await deleteClient(req.params.id);
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting client:', err);
    res.status(500).json({ error: "Erreur lors de la suppression du client" });
  }
});

module.exports = router;
module.exports.getClients = getClients;