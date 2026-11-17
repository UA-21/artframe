'use client';
import { useState } from 'react';
import { api } from '@/lib/client';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/login', { json: { password } });
      window.location.href = '/';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 380, paddingTop: 80 }}>
      <h1>ArtFrame</h1>
      <form className="card" onSubmit={submit}>
        <div className="field">
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy || !password}>
          Sign in
        </button>
      </form>
    </main>
  );
}
