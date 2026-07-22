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
  const [extracting, setExtracting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const navigate = useNavigate();

  async function suggestRoleIfEmpty(text) {
    if (targetRole.trim() || !text.trim()) return;
    setSuggesting(true);
    try {
      const { suggestedTitle } = await api.suggestRole(text);
      if (suggestedTitle) setTargetRole(suggestedTitle);
    } catch {
      // Suggestion is a convenience, not required, fail silently.
    } finally {
      setSuggesting(false);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    setExtracting(true);
    try {
      const { text } = await api.extractResume(file);
      setResumeText(text);
      await suggestRoleIfEmpty(text);
    } catch (err) {
      setError(err.message);
    } finally {
      setExtracting(false);
    }
  }

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
        <p className="hint">Upload a resume file, or paste the text directly, and set the target role to begin.</p>

        <label>Client name</label>
        <input
          type="text"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label>
          Target job title{suggesting && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> — suggesting...</span>}
        </label>
        <input
          type="text"
          placeholder="Healthcare Administration"
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
        />

        <label>Resume file</label>
        <input type="file" accept=".pdf,.docx" onChange={handleFileChange} disabled={extracting} />

        <label style={{ marginTop: 20 }}>
          Resume / LinkedIn content{extracting && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> — extracting text...</span>}
        </label>
        <textarea
          placeholder="Paste resume text here, or upload a file above"
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          onBlur={(e) => suggestRoleIfEmpty(e.target.value)}
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
