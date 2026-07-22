import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api';

export default function AuthGuard({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'ok' | 'unauthenticated'

  useEffect(() => {
    api
      .listClients()
      .then(() => setStatus('ok'))
      .catch(() => setStatus('unauthenticated'));
  }, []);

  if (status === 'checking') {
    return <div className="wrap"><p style={{ color: 'var(--muted)' }}>Loading...</p></div>;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return children;
}
