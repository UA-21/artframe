'use client';
import { useEffect, useState } from 'react';
import { api, type Playlist } from '@/lib/client';

type Artwork = {
  source: string;
  sourceId: string;
  title: string;
  artist: string;
  date: string;
  credit: string;
  url: string;
  thumbUrl: string;
};

export default function Discover() {
  const [source, setSource] = useState('artic');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Artwork[] | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistId, setPlaylistId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Playlist[]>('/api/playlists').then(setPlaylists).catch(() => {});
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError('');
    try {
      setResults(await api<Artwork[]>(`/api/discover?source=${source}&q=${encodeURIComponent(query)}`));
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  async function add(a: Artwork) {
    try {
      await api('/api/images', { json: { ...a, playlistId: playlistId || undefined } });
      setAdded((m) => ({ ...m, [a.source + a.sourceId]: true }));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <h1>Discover</h1>
      <p className="muted">Public-domain art from museum open-access collections.</p>
      <form className="card" onSubmit={search}>
        <div className="field">
          <label>Museum</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="artic">Art Institute of Chicago</option>
            <option value="met">The Metropolitan Museum of Art</option>
          </select>
        </div>
        <div className="row">
          <input className="grow" type="search" placeholder="Monet, landscape, ukiyo-e…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="primary" disabled={busy || !query.trim()}>
            {busy ? 'Searching…' : 'Search'}
          </button>
        </div>
        {playlists.length > 0 && (
          <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
            <label>Also add to playlist</label>
            <select value={playlistId} onChange={(e) => setPlaylistId(e.target.value)}>
              <option value="">Library only</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </form>
      {error && <p className="error">{error}</p>}
      {results && results.length === 0 && <p className="muted">No public-domain works found.</p>}
      {results?.map((a) => (
        <div className="list-item" key={a.source + a.sourceId}>
          <img src={a.thumbUrl} alt="" loading="lazy" style={{ width: 84, height: 84 }} />
          <span className="grow" style={{ whiteSpace: 'normal' }}>
            <em>{a.title || 'Untitled'}</em>
            <br />
            <span className="muted">{[a.artist, a.date].filter(Boolean).join(', ')}</span>
          </span>
          <button onClick={() => add(a)} disabled={added[a.source + a.sourceId]}>
            {added[a.source + a.sourceId] ? 'Added' : 'Add'}
          </button>
        </div>
      ))}
    </>
  );
}
