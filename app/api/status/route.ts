import { guard } from '@/lib/auth';
import { q } from '@/lib/db';
import { isDisplayOn } from '@/lib/settings';
import { getKv, getSettings, getState, toImage, type Presence } from '@/lib/store';

const ONLINE_WINDOW_MS = 35_000;

export async function GET() {
  const no = await guard();
  if (no) return no;
  const [settings, state, presence] = await Promise.all([
    getSettings(),
    getState(),
    getKv<Presence>('presence', { currentImageId: null, lastSeen: 0 }),
  ]);
  const cur = presence.currentImageId ? await q('SELECT * FROM images WHERE id = $1', [presence.currentImageId]) : [];
  const playlists = await q('SELECT id, name FROM playlists ORDER BY created_at');
  return Response.json({
    paused: state.paused,
    online: Date.now() - presence.lastSeen < ONLINE_WINDOW_MS,
    lastSeen: presence.lastSeen,
    scheduledOff: !isDisplayOn(new Date(), settings),
    current: cur.length ? toImage(cur[0]) : null,
    activePlaylistId: settings.activePlaylistId,
    intervalSec: settings.intervalSec,
    playlists,
  });
}
