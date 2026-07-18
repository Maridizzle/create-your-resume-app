const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// TODO: port the existing docx-generation script (color-coded tables,
// green 8+, gray unselected, blue real achievements, orange suggested,
// signed "Maride - 360-265-6823") from the current Node.js + docx pipeline.
router.post('/:clientId/generate', async (req, res) => {
  const { clientId } = req.params;

  const scored = await pool.query(
    'SELECT * FROM results_cache WHERE client_id = $1 ORDER BY pulled_at DESC LIMIT 1',
    [clientId]
  );
  if (!scored.rows[0]) {
    return res.status(400).json({ error: 'No scored results to build a document from yet' });
  }

  // Placeholder, replace with actual docx buffer generation and file response.
  res.status(501).json({ error: 'Docx generation not yet wired in, port existing script here' });
});

module.exports = router;
