const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { generateIntakeDocx } = require('../services/generateIntakeDocx');

const router = express.Router();
router.use(requireAuth);

// Builds job metadata (title/company/years) from the original intake_json,
// and merges in the client's actual scored skills/activities/achievements
// and essay answers from results_cache, matched by job index, both were
// generated from the same job list so the order lines up.
function normalizeForDocx(client, intakeRecord, resultsRecord) {
  const intake = intakeRecord.json_data;
  const scored = resultsRecord.sheet_data;

  const jobs = intake.jobs.map((job, i) => {
    const ratedJob = scored.jobs[i] || {};
    return {
      title: job.title,
      company: job.company,
      years: job.years,
      skills: ratedJob.skills || [],
      activities: ratedJob.activities || [],
      achievements: ratedJob.achievements || []
    };
  });

  const essayQuestions = intake.essayQuestions.map((question, i) => ({
    question,
    answer: scored.essayQuestions[i]?.answer || ''
  }));

  return { clientName: client.name, targetRole: client.target_role, jobs, essayQuestions };
}

router.post('/:clientId/generate', async (req, res) => {
  const { clientId } = req.params;

  const client = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
  if (!client.rows[0]) return res.status(404).json({ error: 'Client not found' });

  const intake = await pool.query(
    'SELECT * FROM intake_json WHERE client_id = $1 ORDER BY version DESC LIMIT 1',
    [clientId]
  );
  if (!intake.rows[0]) {
    return res.status(400).json({ error: 'No intake JSON generated yet' });
  }

  const scored = await pool.query(
    'SELECT * FROM results_cache WHERE client_id = $1 ORDER BY pulled_at DESC LIMIT 1',
    [clientId]
  );
  if (!scored.rows[0]) {
    return res.status(400).json({ error: 'No scored results to build a document from yet' });
  }

  try {
    const data = normalizeForDocx(client.rows[0], intake.rows[0], scored.rows[0]);
    const buffer = await generateIntakeDocx(data);

    const filename = `${data.clientName.replace(/[^a-z0-9]+/gi, '-')}-intake.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Docx generation failed', err.message);
    res.status(500).json({ error: 'Could not generate the document' });
  }
});

module.exports = router;
