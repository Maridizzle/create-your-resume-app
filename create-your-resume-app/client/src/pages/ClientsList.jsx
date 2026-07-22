import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function ClientsList() {
  const [clients, setClients] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listClients().then(setClients).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="wrap">
      <h1 className="display">Create Your Resume</h1>
      <p className="sub">All clients</p>

      <div className="btn-row" style={{ justifyContent: 'flex-start', marginBottom: 24 }}>
        <Link to="/input">
          <button className="btn-primary" type="button">New client</button>
        </Link>
      </div>

      {error && <p className="error-text">{error}</p>}

      {clients.map((c) => (
        <div className="panel-card" key={c.id}>
          <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', margin: '0 0 4px' }}>{c.name}</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
            {c.target_role} · stage: {c.stage || 'input'}
          </p>
        </div>
      ))}

      {clients.length === 0 && !error && (
        <p style={{ color: 'var(--muted)' }}>No clients yet.</p>
      )}
    </div>
  );
}
