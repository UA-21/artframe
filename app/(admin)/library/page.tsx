'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, prepareUpload, type Img, type Playlist } from '@/lib/client';

export default function Library() {
  const [images, setImages] = useState<Img[] | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [sel, setSel] = useState<Img | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setImages(await api<Img[]>('/api/images'));
    setPlaylists(await api<Playlist[]>('/api/playlists'));
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    const failed: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setProgress(`Uploading ${i + 1} of ${files.length}…`);
      try {
        await api('/api/images', { form: await prepareUpload(files[i]) });
      } catch (e) {
        failed.push(`${files[i].name}: ${(e as Error).message}`);
      }
    }
    setProgress('');
    if (failed.length) setError(failed.join(' · '));
    if (fileRef.current) fileRef.current.value = '';
    load();
  }

  async function save(patch: Partial<Img>) {
    if (!sel) return;
    const updated = await api<Img>(`/api/images/${sel.id}`, { method: 'PATCH', json: patch });
    setSel(updated);
    setImages((list) => list && list.map((i) => (i.id === updated.id ? updated : i)));
  }

  async function remove() {
    if (!sel || !confirm('Delete this image?')) return;
    await api(`/api/images/${sel.id}`, { method: 'DELETE' });
    setSel(null);
    load();
  }

  async function addTo(playlistId: string) {
    if (!sel || !playlistId) return;
    await api(`/api/playlists/${playlistId}`, { json: { imageId: sel.id } });
    setProgress('Added to playlist.');
    setTimeout(() => setProgress(''), 2500);
    load();
  }

  return (
    <>
      <h1>Library</h1>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="primary" onClick={() => fileRef.current?.click()} disabled={!!progress && progress.startsWith('Uploading')}>
          Upload images
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden data-testid="file" onChange={(e) => upload(e.target.files)} />
        {progress && <span className="muted">{progress}</span>}
      </div>
      {error && <p className="error">{error}</p>}

      {sel && (
        <div className="card" data-testid="editor">
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <img src={sel.thumbUrl} alt="" style={{ width: 120, borderRadius: 8 }} />
            <div className="grow">
              <div className="field">
                <label>Title</label>
                <input type="text" defaultValue={sel.title} key={sel.id + 't'} onBlur={(e) => save({ title: e.target.value })} />
              </div>
              <div className="field">
                <label>Artist</label>
                <input type="text" defaultValue={sel.artist} key={sel.id + 'a'} onBlur={(e) => save({ artist: e.target.value })} />
              </div>
              <div className="field">
                <label>Date</label>
                <input type="text" defaultValue={sel.date} key={sel.id + 'd'} onBlur={(e) => save({ date: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="field">
            <label>Fit on screen</label>
            <select value={sel.fit || ''} onChange={(e) => save({ fit: (e.target.value || null) as Img['fit'] })}>
              <option value="">Use default</option>
              <option value="contain">Show whole image</option>
              <option value="cover">Fill the screen (crops edges)</option>
            </select>
          </div>
          {playlists.length > 0 && (
            <div className="field">
              <label>Add to playlist</label>
              <select value="" onChange={(e) => addTo(e.target.value)}>
                <option value="">Choose…</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {sel.credit && <p className="muted">{sel.credit}</p>}
          <div className="row">
            <button onClick={() => setSel(null)}>Done</button>
            <button className="danger" onClick={remove}>
              Delete
            </button>
          </div>
        </div>
      )}

      {images === null ? (
        <p className="muted">Loading…</p>
      ) : images.length === 0 ? (
        <p className="muted">No images yet. Upload your own, or find museum art under Discover.</p>
      ) : (
        <div className="grid">
          {images.map((i) => (
            <button key={i.id} className={'tile' + (sel?.id === i.id ? ' selected' : '')} onClick={() => setSel(i)} title={i.title}>
              <img src={i.thumbUrl} alt={i.title} loading="lazy" />
              {i.source !== 'upload' && <span className="badge">{i.source === 'met' ? 'The Met' : 'AIC'}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
