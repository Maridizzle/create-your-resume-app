import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login() {
  const [step, setStep] = useState('password'); // 'password' | 'totp'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.login(username, password);
      if (result.requiresTotp === false) {
        // 2FA not set up yet on this account, shouldn't normally happen
        // once setup is complete, but don't dead-end the user.
        navigate('/input');
        return;
      }
      setStep('totp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.verify2fa(token);
      navigate('/input');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 420, paddingTop: 120 }}>
      <h1 className="display">Create Your Resume</h1>
      <p className="sub">Intake pipeline, internal tool</p>

      <div className="card">
        {step === 'password' ? (
          <form onSubmit={handlePasswordSubmit}>
            <h2>Sign in</h2>
            <p className="hint">Admin access only.</p>
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="error-text">{error}</p>}
            <div className="btn-row">
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleTotpSubmit}>
            <h2>Two-factor code</h2>
            <p className="hint">Enter the code from your authenticator app.</p>
            <label>6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoFocus
              required
            />
            {error && <p className="error-text">{error}</p>}
            <div className="btn-row">
              <button className="btn-ghost" type="button" onClick={() => setStep('password')}>
                Back
              </button>
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Sign in'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
