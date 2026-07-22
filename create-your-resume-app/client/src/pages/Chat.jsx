import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import OrbitTracker from '../components/OrbitTracker';
import { api } from '../api';

export default function Chat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [advancing, setAdvancing] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    api.getChatHistory(id).then(setMessages).catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setError('');
    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', message: text }, { role: 'assistant', message: '' }]);

    try {
      for await (const chunk of api.streamChatMessage(id, text)) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', message: next[next.length - 1].message + chunk };
          return next;
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleContinue() {
    setAdvancing(true);
    try {
      await api.setStage(id, 'checklist');
      navigate(`/clients/${id}/checklist`);
    } catch (err) {
      setError(err.message);
      setAdvancing(false);
    }
  }

  return (
    <div className="wrap">
      <h1 className="display">Create Your Resume</h1>
      <p className="sub">Intake pipeline, internal tool</p>

      <OrbitTracker activeStage="chat" />

      <div className="panel-card" style={{ maxHeight: 420, overflowY: 'auto' }}>
        {messages.length === 0 && <p style={{ color: 'var(--muted)' }}>No messages yet.</p>}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <p className="section-label" style={{ marginBottom: 4 }}>{m.role === 'user' ? 'Maride' : 'Claude'}</p>
            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{m.message}</p>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {error && <p className="error-text">{error}</p>}

      <form className="card" onSubmit={handleSend} style={{ marginTop: 20 }}>
        <label>Message</label>
        <textarea
          placeholder="Refine the intake, ask for missing eras, clarify achievements..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="btn-row">
          <button type="button" className="btn-ghost" onClick={handleContinue} disabled={advancing}>
            {advancing ? 'Continuing...' : 'Continue to checklist'}
          </button>
          <button type="submit" className="btn-primary" disabled={sending || !input.trim()}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
