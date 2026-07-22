import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OrbitTracker from '../components/OrbitTracker';
import { api } from '../api';

export default function Link() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [intakeUrl, setIntakeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getIntake(id)
      .then((intake) => {
        if (intake.intake_url) setIntakeUrl(intake.intake_url);
      })
      .catch(() => {
        // No intake JSON yet, that's fine, the generate button below handles it.
      });
  }, [id]);

  async function handleGenerate() {
    setLoading(true);
    setError('');
    try {
      const result = await api.generateLink(id);
      setIntakeUrl(result.intakeUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(intakeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  async function handleContinue() {
    await api.setStage(id, 'results');
    navigate(`/clients/${id}/results`);
  }

  return (
    <div className="wrap">
      <h1 className="display">Create Your Resume</h1>
      <p className="sub">Intake pipeline, internal tool</p>

      <OrbitTracker activeStage="link" />

      <div className="card">
        <h2>Client intake link</h2>
        <p className="hint">Sends the intake JSON to the client-facing form. Send this link to the client.</p>

        {!intakeUrl && (
          <button type="button" className="btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate client link'}
          </button>
        )}

        {error && <p className="error-text">{error}</p>}
      </div>

      {intakeUrl && (
        <div className="panel-card" style={{ marginTop: 20 }}>
          <p className="section-label">Link ready</p>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, wordBreak: 'break-all', margin: '0 0 16px' }}>
            {intakeUrl}
          </p>
          <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="btn-ghost" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button type="button" className="btn-primary" onClick={handleContinue}>
              Continue to results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
