'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

type S = {
  intervalSec: number;
  shuffle: boolean;
  fit: 'contain' | 'cover';
  matWidth: number;
  matColor: string;
  showCaption: boolean;
  motion: boolean;
  brightness: number;
  scheduleEnabled: boolean;
  onTime: string;
  offTime: string;
  timezone: string;
  deviceToken: string;
};

const INTERVALS: [number, string][] = [
  [30, '30 seconds'],
  [60, '1 minute'],
  [120, '2 minutes'],
  [300, '5 minutes'],
  [600, '10 minutes'],
  [1800, '30 minutes'],
  [3600, '1 hour'],
];

export default function Settings() {
  const [s, setS] = useState<S | null>(null);
  const [storage, setStorage] = useState({ usedBytes: 0, capBytes: 1 });
  const [error, setError] = useState('');
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    api('/api/settings')
      .then((d) => {
        setS(d.settings);
        setStorage(d.storage);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function set(patch: Partial<S>) {
    if (!s) return;
    setS({ ...s, ...patch });
    try {
      setS((await api('/api/settings', { method: 'PATCH', json: patch })).settings);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function logout() {
    await api('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  if (!s) return <p className={error ? 'error' : 'muted'}>{error || 'Loading…'}</p>;
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const frameUrl = `${origin}/frame?device=${s.deviceToken}`;
  const mb = (n: number) => (n / 1024 / 1024).toFixed(0);

  return (
    <>
      <h1>Settings</h1>
      {error && <p className="error">{error}</p>}

      <h2>Slideshow</h2>
      <div className="card">
        <div className="field">
          <label htmlFor="interval">Change image every</label>
          <select id="interval" value={s.intervalSec} onChange={(e) => set({ intervalSec: Number(e.target.value) })}>
            {INTERVALS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={s.shuffle} onChange={(e) => set({ shuffle: e.target.checked })} /> Shuffle
        </label>
      </div>

      <h2>Framing</h2>
      <div className="card">
        <div className="field">
          <label htmlFor="fit">Default fit</label>
          <select id="fit" value={s.fit} onChange={(e) => set({ fit: e.target.value as S['fit'] })}>
            <option value="contain">Show whole image</option>
            <option value="cover">Fill the screen (crops edges)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="mat">Mat width: {s.matWidth ? `${s.matWidth}% of screen height` : 'no mat'}</label>
          <input id="mat" type="range" min={0} max={15} step={1} value={s.matWidth} onChange={(e) => set({ matWidth: Number(e.target.value) })} />
        </div>
        {s.matWidth > 0 && (
          <div className="field">
            <label htmlFor="matColor">Mat colour</label>
            <input id="matColor" type="color" value={s.matColor} onChange={(e) => set({ matColor: e.target.value })} />
            <p className="muted">On an OLED, a bright mat is a static border and can cause burn-in. Dark colours are safer.</p>
          </div>
        )}
        <label className="check">
          <input type="checkbox" checked={s.showCaption} onChange={(e) => set({ showCaption: e.target.checked })} /> Show title and artist
        </label>
      </div>

      <h2>Screen care</h2>
      <div className="card">
        <label className="check">
          <input type="checkbox" checked={s.motion} onChange={(e) => set({ motion: e.target.checked })} /> Slow drift (recommended for OLED)
        </label>
        <div className="field">
          <label htmlFor="brightness">Brightness: {s.brightness}%</label>
          <input id="brightness" type="range" min={20} max={100} step={5} value={s.brightness} onChange={(e) => set({ brightness: Number(e.target.value) })} />
        </div>
      </div>

      <h2>Schedule</h2>
      <div className="card">
        <label className="check">
          <input type="checkbox" checked={s.scheduleEnabled} onChange={(e) => set({ scheduleEnabled: e.target.checked })} /> Show art only during set hours
        </label>
        {s.scheduleEnabled && (
          <>
            <div className="row">
              <div className="grow field">
                <label htmlFor="on">From</label>
                <input id="on" type="time" value={s.onTime} onChange={(e) => set({ onTime: e.target.value })} />
              </div>
              <div className="grow field">
                <label htmlFor="off">Until</label>
                <input id="off" type="time" value={s.offTime} onChange={(e) => set({ offTime: e.target.value })} />
              </div>
            </div>
            <p className="muted">
              Time zone: {s.timezone}.{' '}
              {s.timezone !== browserTz && (
                <a href="#" onClick={(e) => (e.preventDefault(), set({ timezone: browserTz }))}>
                  Use {browserTz}
                </a>
              )}
            </p>
            <p className="muted">Outside these hours the screen goes black (OLED pixels off). The TV itself stays on; use its sleep timer to power it down.</p>
          </>
        )}
      </div>

      <h2>TV link</h2>
      <div className="card">
        <p className="muted">Open this address on the TV (in the ArtFrame app or the TV web browser). Keep it private: anyone with it can view your images.</p>
        <code className="url" data-testid="frame-url">
          {frameUrl}
        </code>
        <p className="muted">Add &amp;debug=1 to show diagnostics on the TV.</p>
      </div>

      <h2>Storage</h2>
      <div className="card">
        <p>
          {mb(storage.usedBytes)} MB of {mb(storage.capBytes)} MB used by uploads
        </p>
      </div>

      <button onClick={logout}>Sign out</button>
    </>
  );
}
