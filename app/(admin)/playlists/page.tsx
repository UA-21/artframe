'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, type Img, type Playlist } from '@/lib/client';

type Detail = { id: string; name: string; items: Img[] };

export default function Playlists() {
  const [lists, setLists] = useState<Playlist[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState<Detail | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLists(await api<Playlist[]>('/api/playlists'));
    setActive((await api('/api/settings')).settings.activePlaylistId);
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const openList = async (id: string) => setOpen(await api<Detail>(`/api/playlists/${id}`));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const p = await api<Playlist>('/api/playlists', { json: { name } });
    setName('');
    await load();
    openList(p.id);
  }

  async function play(id: string | null) {
    await api('/api/settings', { method: 'PATCH', json: { activePlaylistId: id } });
    setActive(id);
  }

  async function reorder(items: Img[]) {
    if (!open) return;
    setOpen({ ...open, items });
    await api(`/api/playlists/${open.id}`, { method: 'PATCH', json: { imageIds: items.map((i) => i.id) } });
    load();
  }

  function move(index: number, dir: number) {
    if (!open) return;
    const items = [...open.items];
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    [items[index], items[j]] = [items[j], items[index]];
    reorder(items);
  }

  async function rename(value: string) {
    if (!open || !value.trim() || value === open.name) return;
    await api(`/api/playlists/${open.id}`, { method: 'PATCH', json: { name: value } });
    setOpen({ ...open, name: value.trim() });
    load();
  }

  async function remove() {
    if (!open || !confirm(`Delete playlist "${open.name}"? Images stay in the library.`)) return;
    await api(`/api/playlists/${open.id}`, { method: 'DELETE' });
    setOpen(null);
    load();
  }

  return (
    <>
      <h1>Playlists</h1>
      {error && <p className="error">{error}</p>}
      <form className="row" onSubmit={create} style={{ marginBottom: 14 }}>
        <input className="grow" type="text" placeholder="New playlist name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="primary" disabled={!name.trim()}>
          Create
        </button>
      </form>

      <div className="card">
        <div className="list-item">
          <span className="grow">All images</span>
          {active === null ? <span className="muted">Playing</span> : <button onClick={() => play(null)}>Play</button>}
        </div>
        {lists?.map((p) => (
          <div className="list-item" key={p.id}>
            <span className="grow">
              {p.name} <span className="muted">· {p.count}</span>
            </span>
            <button onClick={() => openList(p.id)}>Edit</button>
            {active === p.id ? <span className="muted">Playing</span> : <button onClick={() => play(p.id)}>Play</button>}
          </div>
        ))}
      </div>

      {open && (
        <div className="card" data-testid="playlist-detail">
          <div className="field">
            <label>Name</label>
            <input type="text" defaultValue={open.name} key={open.id} onBlur={(e) => rename(e.target.value)} />
          </div>
          {open.items.length === 0 && <p className="muted">Empty. Add images from the Library or Discover tabs.</p>}
          {open.items.map((img, i) => (
            <div className="list-item" key={img.id}>
              <img src={img.thumbUrl} alt="" />
              <span className="grow">{img.title || 'Untitled'}</span>
              <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                ↑
              </button>
              <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === open.items.length - 1} aria-label="Move down">
                ↓
              </button>
              <button className="icon-btn danger" onClick={() => reorder(open.items.filter((x) => x.id !== img.id))} aria-label="Remove">
                ✕
              </button>
            </div>
          ))}
          <div className="row" style={{ marginTop: 12 }}>
            <button onClick={() => setOpen(null)}>Done</button>
            <button className="danger" onClick={remove}>
              Delete playlist
            </button>
          </div>
        </div>
      )}
    </>
  );
}
