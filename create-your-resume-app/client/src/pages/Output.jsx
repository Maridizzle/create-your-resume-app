import { useState } from 'react';
import { useParams } from 'react-router-dom';
import OrbitTracker from '../components/OrbitTracker';
import { api } from '../api';

export default function Output() {
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    setLoading(true);
    setError('');
    try {
      const { blob, filename } = await api.generateOutput(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      await api.setStage(id, 'complete');
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <h1 className="display">Create Your Resume</h1>
      <p className="sub">Intake pipeline, internal tool</p>

      <OrbitTracker activeStage="output" />

      <div className="card">
        <h2>Final intake document</h2>
        <p className="hint">Generates the formatted .docx summary from the client's scored results.</p>

        <button type="button" className="btn-primary" onClick={handleGenerate} disabled={loading}>
          {loading ? 'Generating...' : 'Generate document'}
        </button>

        {error && <p className="error-text">{error}</p>}
        {done && <p style={{ color: 'var(--green)', marginTop: 16 }}>Document downloaded. Pipeline complete.</p>}
      </div>
    </div>
  );
}
