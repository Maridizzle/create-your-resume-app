const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// TODO: port the full "Intake Builder" system prompt from Project 2 here.
// This is the prompt that turns a resume + target role into the era-aware
// skills/activities/achievements JSON structure, era notes, isReal flags,
// and the 5 essay questions, per the scoring rules (5 skills, 5 activities,
// 3 achievements per job cap; 1 = not selected, never weakness).
const SYSTEM_PROMPT = `[paste the full Intake Builder system prompt here]`;

router.get('/:clientId/history', async (req, res) => {
  const result = await pool.query(
    'SELECT role, message, created_at FROM chat_logs WHERE client_id = $1 ORDER BY created_at ASC',
    [req.params.clientId]
  );
  res.json(result.rows);
});

// Streams a Claude response back to the client and logs both turns.
router.post('/:clientId/message', async (req, res) => {
  const { clientId } = req.params;
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  await pool.query('INSERT INTO chat_logs (client_id, role, message) VALUES ($1, $2, $3)', [
    clientId,
    'user',
    message
  ]);

  const history = await pool.query(
    'SELECT role, message FROM chat_logs WHERE client_id = $1 ORDER BY created_at ASC',
    [clientId]
  );

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullResponse = '';

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: history.rows.map((row) => ({
        role: row.role === 'assistant' ? 'assistant' : 'user',
        content: row.message
      }))
    });

    stream.on('text', (text) => {
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    stream.on('end', async () => {
      await pool.query('INSERT INTO chat_logs (client_id, role, message) VALUES ($1, $2, $3)', [
        clientId,
        'assistant',
        fullResponse
      ]);
      res.write('data: [DONE]\n\n');
      res.end();
    });

    stream.on('error', (err) => {
      console.error('Claude stream error', err);
      res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
      res.end();
    });
  } catch (err) {
    console.error('Chat error', err);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

module.exports = router;
