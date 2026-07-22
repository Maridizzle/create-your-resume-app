import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OrbitTracker from '../components/OrbitTracker';
import { api } from '../api';

function scoreColor(score) {
  return score >= 8 ? 'var(--green)' : 'var(--gray)';
}

function ScoredList({ items }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {items.map((item, i) => (
        <p key={i} style={{ margin: '0 0 6px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5 }}>
          <span style={{ color: scoreColor(item.score) }}>[{item.score ?? '?'}]</span> {item.text}
        </p>
      ))}
    </div>
  );
}

function AchievementList({ items }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {items.map((item, i) => (
        <p key={i} style={{ margin: '0 0 6px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5 }}>
          <span style={{ color: item.isReal ? 'var(--blue)' : 'var(--orange)' }}>
            [{item.isReal ? 'REAL' : 'SUGGESTED'} {item.score ?? '?'}]
          </span>{' '}
          {item.text}
        </p>
      ))}
    </div>
  );
}

export default function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getResults(id).then((r) => setResults(r.sheet_data)).catch(() => {});
  }, [id]);

  async function handleRefresh() {
    setLoading(true);
    setError('');
    try {
      const r = await api.refreshResults(id);
      setResults(r.sheet_data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue() {
    await api.setStage(id, 'output');
    navigate(`/clients/${id}/output`);
  }

  return (
    <div className="wrap">
      <h1 className="display">Create Your Resume</h1>
      <p className="sub">Intake pipeline, internal tool</p>

      <OrbitTracker activeStage="results" />

      <div className="btn-row" style={{ justifyContent: 'flex-start', marginBottom: 24 }}>
        <button type="button" className="btn-primary" onClick={handleRefresh} disabled={loading}>
          {loading ? 'Pulling...' : 'Pull latest results'}
        </button>
        {results && (
          <button type="button" className="btn-ghost" onClick={handleContinue}>
            Continue to output
          </button>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      {!results && !error && <p style={{ color: 'var(--muted)' }}>No results pulled yet.</p>}

      {results && (
        <>
          <div className="panel-card">
            <p className="section-label">Legend</p>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, margin: 0 }}>
              <span style={{ color: 'var(--green)' }}>green</span> score 8-10 selected &middot;{' '}
              <span style={{ color: 'var(--gray)' }}>gray</span> score 1 unselected &middot;{' '}
              <span style={{ color: 'var(--blue)' }}>blue</span> real achievement &middot;{' '}
              <span style={{ color: 'var(--orange)' }}>orange</span> suggested achievement
            </p>
          </div>

          {results.jobs.map((job, i) => (
            <div className="panel-card" key={i}>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', margin: '0 0 2px' }}>
                {job.title}, {job.company}
              </h3>
              <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 16px' }}>{job.years}</p>

              <p className="section-label">Skills</p>
              <ScoredList items={job.skills} />

              <p className="section-label">Activities</p>
              <ScoredList items={job.activities} />

              <p className="section-label">Achievements</p>
              <AchievementList items={job.achievements} />
            </div>
          ))}

          <div className="panel-card">
            <p className="section-label">Essay responses</p>
            {results.essayQuestions.map((qa, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <p style={{ fontWeight: 500, margin: '0 0 4px' }}>{qa.question}</p>
                <p style={{ color: 'var(--muted)', margin: 0, whiteSpace: 'pre-wrap' }}>{qa.answer}</p>
              </div>
            ))}
          </div>

          {results.additionalComments && (
            <div className="panel-card">
              <p className="section-label">Additional comments</p>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{results.additionalComments}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
