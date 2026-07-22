import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OrbitTracker from '../components/OrbitTracker';
import { api } from '../api';

export default function Input() {
  const [name, setName] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !targetRole.trim()) {
      setError('Client name and target role are required.');
      return;
    }
    setLoading(true);
    try {
      const client = await api.createClient({ name, targetRole, resumeText });
      await api.setStage(client.id, 'chat');
      navigate(`/clients/${client.id}/chat`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft() {
    setError('');
    if (!name.trim() || !targetRole.trim()) {
      setError('Client name and target role are required.');
      return;
    }
    setLoading(true);
    try {
      await api.createClient({ name, targetRole, resumeText });
      navigate('/clients');
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

      <OrbitTracker activeStage="input" />

      <p className="section-label">New client intake</p>
      <form className="card" onSubmit={handleSubmit}>
        <h2>New client intake</h2>
        <p className="hint">Paste the resume text and set the target role to begin.</p>

        <label>Client name</label>
        <input
          type="text"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label>Target job title</label>
        <input
          type="text"
          placeholder="Healthcare Administration"
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
        />

        <label>Resume / LinkedIn content</label>
        <textarea
          placeholder="Paste resume text here"
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
        />

        {error && <p className="error-text">{error}</p>}

        <div className="btn-row">
          <button type="button" className="btn-ghost" onClick={handleSaveDraft} disabled={loading}>
            Save draft
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Starting...' : 'Start chat'}
          </button>
        </div>
      </form>
    </div>
  );
}
