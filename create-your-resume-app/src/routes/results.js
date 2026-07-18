const express = require('express');
const { google } = require('googleapis');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function getSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  return google.sheets({ version: 'v4', auth });
}

// Pulls fresh data from the Sheet and caches it. Filter to this client's
// row(s) once the Sheet's actual column layout is confirmed, this is a
// raw pull for now.
router.post('/:clientId/refresh', async (req, res) => {
  const { clientId } = req.params;
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A1:Z1000' // TODO: narrow to the actual results tab/range
    });

    const rows = response.data.values || [];

    const cached = await pool.query(
      'INSERT INTO results_cache (client_id, sheet_data) VALUES ($1, $2) RETURNING *',
      [clientId, JSON.stringify(rows)]
    );

    res.json(cached.rows[0]);
  } catch (err) {
    console.error('Sheets pull failed', err.message);
    res.status(502).json({ error: 'Could not reach Google Sheets' });
  }
});

router.get('/:clientId', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM results_cache WHERE client_id = $1 ORDER BY pulled_at DESC LIMIT 1',
    [req.params.clientId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'No results pulled yet' });
  res.json(result.rows[0]);
});

module.exports = router;
