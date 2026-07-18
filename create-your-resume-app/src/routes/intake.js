const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// TODO: generate a review checklist from the chat transcript, confirming
// nothing is missing before JSON generation: eras covered for every job,
// achievements present or flagged suggested, no section over the caps
// (5 skills, 5 activities, 3 achievements per job).
router.post('/:clientId/checklist', async (req, res) => {
  const { clientId } = req.params;
  // Placeholder response shape, wire up to Claude once ported from Project 2.
  res.json({
    clientId,
    checklist: [
      { item: 'All jobs identified with correct eras', checked: false },
      { item: 'Skills capped at 5 per job', checked: false },
      { item: 'Activities capped at 5 per job', checked: false },
      { item: 'Achievements capped at 3 per job', checked: false },
      { item: 'Real vs suggested achievements flagged', checked: false }
    ]
  });
});

// TODO: port the Intake Builder JSON generation logic from Project 2.
// Takes the chat transcript + target role, returns the structured JSON
// (clientName, jobTitle, jobs[], essayQuestions[]).
router.post('/:clientId/generate', async (req, res) => {
  const { clientId } = req.params;
  const { jsonData } = req.body; // supplied once the generation step is wired in

  if (!jsonData) {
    return res.status(400).json({ error: 'jsonData required, generation step not yet wired in' });
  }

  const existing = await pool.query(
    'SELECT MAX(version) as max_version FROM intake_json WHERE client_id = $1',
    [clientId]
  );
  const nextVersion = (existing.rows[0].max_version || 0) + 1;

  const result = await pool.query(
    'INSERT INTO intake_json (client_id, version, json_data) VALUES ($1, $2, $3) RETURNING *',
    [clientId, nextVersion, jsonData]
  );

  res.status(201).json(result.rows[0]);
});

// TODO: port admin.html's upload-and-generate-link logic. This should
// push the intake JSON somewhere the client-facing form
// (maridizzle.github.io/resume-bullet-menu) can load it, then return the
// unique URL.
router.post('/:clientId/link', async (req, res) => {
  const { clientId } = req.params;
  const token = crypto.randomBytes(8).toString('hex');
  const intakeUrl = `https://maridizzle.github.io/resume-bullet-menu/?id=${token}`;

  await pool.query('UPDATE intake_json SET intake_url = $1 WHERE client_id = $2 AND id = (SELECT id FROM intake_json WHERE client_id = $2 ORDER BY version DESC LIMIT 1)', [
    intakeUrl,
    clientId
  ]);

  res.json({ intakeUrl });
});

router.get('/:clientId', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM intake_json WHERE client_id = $1 ORDER BY version DESC LIMIT 1',
    [req.params.clientId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'No intake JSON yet' });
  res.json(result.rows[0]);
});

module.exports = router;
