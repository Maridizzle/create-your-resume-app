import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OrbitTracker from '../components/OrbitTracker';
import { api } from '../api';

export default function Checklist() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [checklist, setChecklist] = useState(null);
  const [jsonData, setJsonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setLoading(true);
    setError('');
    try {
      const result = await api.getChecklist(id);
      setChecklist(result.checklist);
      setJsonData(result.jsonData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    setError('');
    try {
      await api.generateIntake(id, jsonData);
      await api.setStage(id, 'link');
      navigate(`/clients/${id}/link`);
    } catch (err) {
      setError(err.message);
      setConfirming(false);
    }
  }

  const allChecked = checklist && checklist.every((c) => c.checked);

  return (
    <div className="wrap">
      <h1 className="display">Create Your Resume</h1>
      <p className="sub">Intake pipeline, internal tool</p>

      <OrbitTracker activeStage="checklist" />

      <div className="card">
        <h2>Review checklist</h2>
        <p className="hint">Generates the structured intake JSON from the chat transcript and checks it for gaps.</p>

        {!checklist && (
          <button type="button" className="btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate checklist'}
          </button>
        )}

        {error && <p className="error-text">{error}</p>}
      </div>

      {checklist && (
        <div className="panel-card" style={{ marginTop: 20 }}>
          <p className="section-label">Checklist</p>
          {checklist.map((c, i) => (
            <p key={i} style={{ margin: '0 0 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
              <span style={{ color: c.checked ? 'var(--green)' : 'var(--orange)' }}>
                {c.checked ? '[PASS]' : '[CHECK]'}
              </span>{' '}
              {c.item}
            </p>
          ))}

          <div className="btn-row" style={{ marginTop: 24 }}>
            <button type="button" className="btn-ghost" onClick={handleGenerate} disabled={loading}>
              Regenerate
            </button>
            <button type="button" className="btn-primary" onClick={handleConfirm} disabled={confirming}>
              {confirming ? 'Saving...' : allChecked ? 'Confirm and continue' : 'Continue anyway'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
