// Parses the two JSON/text blobs the client-facing form (resume-bullet-menu)
// writes back into the "Job Ratings" and "Essay Answers" Sheet columns.
// Confirmed against a real completed row, not guessed:
//   Job Ratings: JSON array of { job: "<title> at <company> (<years>)",
//     skills: ["<text>: <score>/10", ...], activities: [...],
//     achievements: ["<text> [Suggested|Real]: <score>/10", ...] }
//   Essay Answers: plain text, five "Q<n>: ..." / "A: ..." pairs
//   separated by blank lines, not JSON.

const JOB_LINE = /^(.*) at (.*) \((.*)\)$/;
const SCORED_LINE = /^(.*): (\d+)\/10$/;
const ACHIEVEMENT_LINE = /^(.*) \[(Suggested|Real)\]: (\d+)\/10$/;

function parseScoredLine(raw) {
  const match = raw.match(SCORED_LINE);
  if (!match) return { text: raw, score: null };
  return { text: match[1], score: Number(match[2]) };
}

function parseAchievementLine(raw) {
  const match = raw.match(ACHIEVEMENT_LINE);
  if (!match) return { text: raw, score: null, isReal: false };
  return { text: match[1], isReal: match[2] === 'Real', score: Number(match[3]) };
}

function parseJobHeader(raw) {
  const match = raw.match(JOB_LINE);
  if (!match) return { title: raw, company: '', years: '' };
  return { title: match[1], company: match[2], years: match[3] };
}

function parseJobRatings(rawJson) {
  const jobs = JSON.parse(rawJson);
  return jobs.map((job) => ({
    ...parseJobHeader(job.job || ''),
    skills: (job.skills || []).map(parseScoredLine),
    activities: (job.activities || []).map(parseScoredLine),
    achievements: (job.achievements || []).map(parseAchievementLine)
  }));
}

function parseEssayAnswers(rawText) {
  const blocks = rawText.trim().split(/\n\s*\n/);
  return blocks.map((block) => {
    const lines = block.split('\n');
    const question = (lines[0] || '').replace(/^Q\d+:\s*/, '').trim();
    const answer = lines
      .slice(1)
      .join('\n')
      .replace(/^A:\s*/, '')
      .trim();
    return { question, answer };
  });
}

module.exports = { parseJobRatings, parseEssayAnswers };
