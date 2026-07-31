const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { INTAKE_JSON_PROMPT } = require('../services/intakeBuilderPrompt');

const router = express.Router();
router.use(requireAuth);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Claude sometimes wraps its JSON reply in a ```json ... ``` fence despite
// being told not to, strip that before parsing.
function extractJson(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : raw).trim();
}

function buildChecklist(jsonData) {
  const jobs = jsonData.jobs || [];
  return [
    {
      item: 'All jobs identified with correct eras',
      checked: jobs.length > 0 && jobs.every((j) => j.title && j.company && j.years)
    },
    {
      item: 'Skills present for every job',
      checked: jobs.every((j) => Array.isArray(j.skills) && j.skills.length > 0)
    },
    {
      item: 'Activities present for every job',
      checked: jobs.every((j) => Array.isArray(j.activities) && j.activities.length > 0)
    },
    {
      item: 'Achievements present for every job, real vs suggested flagged',
      checked: jobs.every(
        (j) =>
          Array.isArray(j.achievements) &&
          j.achievements.length > 0 &&
          j.achievements.every((a) => typeof a.isReal === 'boolean')
      )
    },
    {
      item: '5 essay questions generated',
      checked: Array.isArray(jsonData.essayQuestions) && jsonData.essayQuestions.length === 5
    }
  ];
}

// Generates the structured intake JSON from the chat transcript via the
// same Intake Builder prompt used in chat.js, then derives a pass/fail
// checklist from the actual output so nothing is missing before the
// client-facing link is generated.
router.post('/:clientId/checklist', async (req, res) => {
  const { clientId } = req.params;

  const history = await pool.query(
    'SELECT role, message FROM chat_logs WHERE client_id = $1 ORDER BY created_at ASC',
    [clientId]
  );
  if (history.rows.length === 0) {
    return res.status(400).json({ error: 'No chat transcript yet, nothing to build a checklist from' });
  }

  // chat_logs naturally ends on the assistant's last reply (the point
  // where the conversation paused), but Claude requires the messages
  // array to end on a user turn, it doesn't support assistant-message
  // prefill. Append a synthetic instruction so the array always ends
  // in 'user' regardless of where the chat transcript actually left off.
  const messages = [
    ...history.rows.map((row) => ({
      role: row.role === 'assistant' ? 'assistant' : 'user',
      content: row.message
    })),
    {
      role: 'user',
      content:
        'Generate the structured intake JSON now, based on the conversation above. ' +
        'Output ONLY a single JSON object with exactly these top-level keys: clientName, jobTitle, jobs, essayQuestions. ' +
        'No other top-level keys (no notes, no strategy commentary), no markdown code fences, no text before or after the JSON.'
    }
  ];

  let raw;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: INTAKE_JSON_PROMPT,
      messages
    });
    raw = response.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
  } catch (err) {
    console.error('Checklist generation failed', err.message);
    return res.status(502).json({ error: 'Could not generate intake JSON from the transcript' });
  }

  try {
    const jsonData = JSON.parse(extractJson(raw));
    res.json({ clientId, jsonData, checklist: buildChecklist(jsonData) });
  } catch (err) {
    console.error('Checklist JSON parse failed', err.message, 'raw length:', raw.length, 'raw:', raw.slice(0, 2000));
    res.status(502).json({ error: 'Claude did not return valid JSON, see server logs' });
  }
});

// Takes the structured intake JSON (produced by the checklist step above)
// and persists it as a new version.
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

// Pushes the intake JSON to the same Google Apps Script web app the old
// admin.html tool used (action: 'storeIntake'). The Apps Script owns
// token generation and storage, we just relay its response, we don't
// invent our own URL scheme here.
router.post('/:clientId/link', async (req, res) => {
  const { clientId } = req.params;

  const latest = await pool.query(
    'SELECT * FROM intake_json WHERE client_id = $1 ORDER BY version DESC LIMIT 1',
    [clientId]
  );
  const record = latest.rows[0];
  if (!record) return res.status(400).json({ error: 'No intake JSON generated yet' });

  const jsonData = record.json_data;
  const missing = [];
  if (!jsonData.clientName) missing.push('clientName');
  if (!jsonData.jobTitle) missing.push('jobTitle');
  if (!Array.isArray(jsonData.jobs) || jsonData.jobs.length === 0) missing.push('jobs');
  if (!Array.isArray(jsonData.essayQuestions) || jsonData.essayQuestions.length === 0) missing.push('essayQuestions');
  if (missing.length > 0) {
    return res.status(400).json({ error: `Intake JSON missing required fields: ${missing.join(', ')}` });
  }

  if (!process.env.APPS_SCRIPT_URL) {
    return res.status(500).json({ error: 'APPS_SCRIPT_URL is not configured' });
  }

  try {
    const scriptRes = await fetch(process.env.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'storeIntake',
        clientName: jsonData.clientName,
        jobTitle: jsonData.jobTitle,
        intakeJSON: jsonData
      })
    });
    const data = await scriptRes.json();
    if (!data.success) throw new Error(data.error || 'Apps Script did not report success');

    await pool.query('UPDATE intake_json SET intake_url = $1 WHERE id = $2', [data.url, record.id]);

    res.json({ intakeUrl: data.url });
  } catch (err) {
    console.error('Link generation failed', err.message);
    res.status(502).json({ error: 'Could not generate client link' });
  }
});

// Returns the latest intake JSON version, but the client-facing link is
// carried forward from whichever version it was generated on, even if
// the intake JSON has since been regenerated into a newer version with
// no link of its own, so a previously sent link is never lost from view.
router.get('/:clientId', async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM intake_json WHERE client_id = $1 ORDER BY version DESC LIMIT 1',
    [req.params.clientId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'No intake JSON yet' });

  const latest = result.rows[0];
  if (!latest.intake_url) {
    const linked = await pool.query(
      'SELECT intake_url FROM intake_json WHERE client_id = $1 AND intake_url IS NOT NULL ORDER BY version DESC LIMIT 1',
      [req.params.clientId]
    );
    if (linked.rows[0]) latest.intake_url = linked.rows[0].intake_url;
  }

  res.json(latest);
});

module.exports = router;
