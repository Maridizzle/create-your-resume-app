const express = require('express');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only PDF and .docx files are supported'));
    }
    cb(null, true);
  }
});

async function extractText(file) {
  if (file.mimetype === 'application/pdf') {
    const parser = new PDFParse({ data: file.buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }
  const result = await mammoth.extractRawText({ buffer: file.buffer });
  return result.value;
}

// Extracts plain text from one or more uploaded resume files (PDF or
// .docx), so the Input screen can populate the same resumeText field the
// manual-paste path already uses. Multiple files (e.g. a resume plus a
// LinkedIn export) are combined into one labeled block so they get
// analyzed together, not separately. Doesn't persist the files, extract
// and discard.
router.post('/extract-resume', (req, res) => {
  upload.array('files', 10)(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const extracted = await Promise.all(
        req.files.map(async (file) => ({ filename: file.originalname, text: await extractText(file) }))
      );
      const text =
        extracted.length === 1
          ? extracted[0].text
          : extracted.map((f) => `--- ${f.filename} ---\n${f.text}`).join('\n\n');
      res.json({ text, files: extracted.map((f) => f.filename) });
    } catch (extractErr) {
      console.error('Resume extraction failed', extractErr.message);
      res.status(422).json({ error: 'Could not extract text from one of those files' });
    }
  });
});

// Suggests (doesn't replace) a target job title from the resume text, so
// the Input screen can pre-fill the field while still letting Maride
// override it.
router.post('/suggest-role', async (req, res) => {
  const { resumeText } = req.body;
  if (!resumeText || !resumeText.trim()) {
    return res.status(400).json({ error: 'resumeText required' });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 50,
      system:
        "Given a resume, suggest the single most relevant target job title for this person's next role. Respond with only the job title, nothing else, no explanation, no punctuation beyond what the title itself needs.",
      messages: [{ role: 'user', content: resumeText }]
    });
    const suggestedTitle = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();
    res.json({ suggestedTitle });
  } catch (err) {
    console.error('Role suggestion failed', err.message);
    res.status(502).json({ error: 'Could not suggest a target role' });
  }
});

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
