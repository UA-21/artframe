import { randomBytes } from 'node:crypto';
import { q, type Row } from './db';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from './settings';

export type Image = {
  id: string;
  source: string;
  title: string;
  artist: string;
  date: string;
  credit: string;
  url: string;
  thumbUrl: string;
  width: number | null;
  height: number | null;
  fit: 'contain' | 'cover' | null;
  createdAt: string;
};

export const toImage = (r: Row): Image => ({
  id: r.id,
  source: r.source,
  title: r.title,
  artist: r.artist,
  date: r.date_text,
  credit: r.credit,
  url: r.url,
  thumbUrl: r.thumb_url,
  width: r.width,
  height: r.height,
  fit: r.fit,
  createdAt: r.created_at,
});

export async function getKv<T>(key: string, fallback: T): Promise<T> {
  const rows = await q('SELECT value FROM kv WHERE key = $1', [key]);
  return rows.length ? (rows[0].value as T) : fallback;
}

export async function setKv(key: string, value: unknown): Promise<void> {
  await q(
    'INSERT INTO kv (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    [key, JSON.stringify(value)],
  );
}

export async function getSettings(): Promise<Settings> {
  const s = { ...DEFAULT_SETTINGS, ...(await getKv<Partial<Settings>>('settings', {})) };
  if (!s.deviceToken) {
    s.deviceToken = randomBytes(24).toString('base64url');
    await setKv('settings', s);
  }
  return s;
}

export async function updateSettings(patch: Record<string, unknown>): Promise<Settings> {
  const next = { ...(await getSettings()), ...sanitizeSettings(patch) };
  await setKv('settings', next);
  await bumpVersion();
  return next;
}

/** Playback state shared between the control UI and the TV. */
export type State = { version: number; paused: boolean; cmdSeq: number; cmdType: 'next' | 'prev' | null };
const DEFAULT_STATE: State = { version: 1, paused: false, cmdSeq: 0, cmdType: null };

export async function getState(): Promise<State> {
  return { ...DEFAULT_STATE, ...(await getKv<Partial<State>>('state', {})) };
}

export async function patchState(fn: (s: State) => void): Promise<State> {
  const s = await getState();
  fn(s);
  await setKv('state', s);
  return s;
}

/** Tell the TV that images, playlists or settings changed and it should reload its playlist. */
export const bumpVersion = () => patchState((s) => void s.version++);

/** What the TV last reported; kept apart from State so TV polls never overwrite commands. */
export type Presence = { currentImageId: string | null; lastSeen: number };

/** Images of the active playlist in order, or the whole library when no playlist is active. */
export async function activeImages(settings: Settings): Promise<Image[]> {
  if (settings.activePlaylistId) {
    const rows = await q(
      `SELECT i.* FROM playlist_items p JOIN images i ON i.id = p.image_id
       WHERE p.playlist_id = $1 ORDER BY p.position`,
      [settings.activePlaylistId],
    );
    return rows.map(toImage);
  }
  return (await q('SELECT * FROM images ORDER BY created_at DESC')).map(toImage);
}

export async function storageUsedBytes(): Promise<number> {
  return Number((await q('SELECT COALESCE(SUM(bytes), 0) AS total FROM images'))[0].total);
}

export const storageCapBytes = () => (Number(process.env.MAX_STORAGE_MB) || 900) * 1024 * 1024;
