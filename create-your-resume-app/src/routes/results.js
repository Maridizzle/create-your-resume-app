const express = require('express');
const { google } = require('googleapis');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { parseJobRatings, parseEssayAnswers } = require('../services/parseSheetRow');

const router = express.Router();
router.use(requireAuth);

// Sheet columns (A-H): Timestamp | dh8qvg97 (client token) | Name | Email |
// Target Job Title | Job Ratings | Essay Answers | Additional Comments
const COL = { TIMESTAMP: 0, TOKEN: 1, NAME: 2, EMAIL: 3, TARGET_JOB_TITLE: 4, JOB_RATINGS: 5, ESSAY_ANSWERS: 6, ADDITIONAL_COMMENTS: 7 };

function getSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  return google.sheets({ version: 'v4', auth });
}

// Pulls the client's completed row from the Sheet by matching the token
// embedded in their intake_url (the same token the Apps Script generated
// when the link was created), parses it, and caches the parsed result.
router.post('/:clientId/refresh', async (req, res) => {
  const { clientId } = req.params;

  const intake = await pool.query(
    'SELECT intake_url FROM intake_json WHERE client_id = $1 ORDER BY version DESC LIMIT 1',
    [clientId]
  );
  const intakeUrl = intake.rows[0]?.intake_url;
  if (!intakeUrl) {
    return res.status(400).json({ error: 'No client link generated yet' });
  }

  const token = new URL(intakeUrl).searchParams.get('id');
  if (!token) {
    return res.status(500).json({ error: 'Stored intake URL has no id token' });
  }

  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'A2:H1000' // skip the header row
    });

    const rows = response.data.values || [];
    const row = rows.find((r) => r[COL.TOKEN] === token);
    if (!row) {
      return res.status(404).json({ error: 'This client has not completed the intake form yet' });
    }

    const parsed = {
      timestamp: row[COL.TIMESTAMP],
      name: row[COL.NAME],
      email: row[COL.EMAIL],
      targetJobTitle: row[COL.TARGET_JOB_TITLE],
      jobs: parseJobRatings(row[COL.JOB_RATINGS]),
      essayQuestions: parseEssayAnswers(row[COL.ESSAY_ANSWERS] || ''),
      additionalComments: row[COL.ADDITIONAL_COMMENTS] || ''
    };

    const cached = await pool.query(
      'INSERT INTO results_cache (client_id, sheet_data) VALUES ($1, $2) RETURNING *',
      [clientId, JSON.stringify(parsed)]
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
