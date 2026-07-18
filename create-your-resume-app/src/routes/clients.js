const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// List all clients, most recently updated first.
router.get('/', async (req, res) => {
  const result = await pool.query(
    `SELECT c.*, ps.stage FROM clients c
     LEFT JOIN LATERAL (
       SELECT stage FROM pipeline_state WHERE client_id = c.id ORDER BY updated_at DESC LIMIT 1
     ) ps ON true
     ORDER BY c.updated_at DESC`
  );
  res.json(result.rows);
});

// Create a new client, resume text and target role, starts the pipeline.
router.post('/', async (req, res) => {
  const { name, targetRole, resumeText } = req.body;
  if (!name || !targetRole) {
    return res.status(400).json({ error: 'Client name and target role are required' });
  }

  const client = await pool.query(
    `INSERT INTO clients (name, target_role) VALUES ($1, $2) RETURNING *`,
    [name, targetRole]
  );
  const clientId = client.rows[0].id;

  await pool.query(`INSERT INTO pipeline_state (client_id, stage) VALUES ($1, 'input')`, [clientId]);

  if (resumeText) {
    await pool.query(
      `INSERT INTO chat_logs (client_id, role, message) VALUES ($1, 'user', $2)`,
      [clientId, resumeText]
    );
  }

  res.status(201).json(client.rows[0]);
});

router.get('/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) return res.status(404).json({ error: 'Client not found' });
  res.json(result.rows[0]);
});

// Advance or set a client's pipeline stage.
router.post('/:id/stage', async (req, res) => {
  const { stage } = req.body;
  const validStages = ['input', 'chat', 'checklist', 'link', 'results', 'output', 'complete'];
  if (!validStages.includes(stage)) {
    return res.status(400).json({ error: 'Invalid stage' });
  }
  await pool.query('INSERT INTO pipeline_state (client_id, stage) VALUES ($1, $2)', [req.params.id, stage]);
  await pool.query('UPDATE clients SET status = $1, updated_at = now() WHERE id = $2', [stage, req.params.id]);
  res.json({ success: true, stage });
});

module.exports = router;
