'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, type Img } from '@/lib/client';

type Status = {
  paused: boolean;
  online: boolean;
  lastSeen: number;
  scheduledOff: boolean;
  current: Img | null;
  activePlaylistId: string | null;
  intervalSec: number;
  playlists: { id: string; name: string }[];
};

export default function Now() {
  const [s, setS] = useState<Status | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(() => api<Status>('/api/status').then(setS).catch(() => {}), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  async function playback(action: string) {
    await api('/api/playback', { json: { action } });
    if (action === 'next' || action === 'prev') {
      setNote('Sent — the TV picks it up within about 10 seconds.');
      setTimeout(() => setNote(''), 6000);
    }
    load();
  }

  async function setPlaylist(id: string) {
    await api('/api/settings', { method: 'PATCH', json: { activePlaylistId: id || null } });
    load();
  }

  if (!s) return <p className="muted">Loading…</p>;
  return (
    <>
      <h1>Now showing</h1>
      <p className="muted" data-testid="tv-status">
        <span className={'dot' + (s.online ? ' on' : '')} />
        {s.online
          ? s.scheduledOff
            ? 'TV connected — screen is off by schedule'
            : s.paused
              ? 'TV connected — paused'
              : 'TV connected'
          : s.lastSeen
            ? 'TV not connected (last seen ' + new Date(s.lastSeen).toLocaleString() + ')'
            : 'TV has never connected — see Settings for the frame link'}
      </p>
      <div className="preview">
        {s.current ? <img src={s.current.thumbUrl} alt={s.current.title} data-testid="current" data-id={s.current.id} /> : <span className="muted">Nothing on screen</span>}
      </div>
      {s.current && (
        <p>
          <em>{s.current.title || 'Untitled'}</em>
          {s.current.artist && <span className="muted"> — {s.current.artist}</span>}
        </p>
      )}
      <div className="controls">
        <button onClick={() => playback('prev')}>◀ Previous</button>
        <button className="primary" onClick={() => playback(s.paused ? 'play' : 'pause')}>
          {s.paused ? '▶ Play' : '❚❚ Pause'}
        </button>
        <button onClick={() => playback('next')}>Next ▶</button>
      </div>
      {note && <p className="muted">{note}</p>}
      <div className="card">
        <label htmlFor="pl">Playing from</label>
        <select id="pl" value={s.activePlaylistId || ''} onChange={(e) => setPlaylist(e.target.value)}>
          <option value="">All images</option>
          {s.playlists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
