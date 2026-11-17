import { guard } from '@/lib/auth';
import { q } from '@/lib/db';
import { getSettings, storageCapBytes, storageUsedBytes, updateSettings } from '@/lib/store';

export async function GET() {
  const no = await guard();
  if (no) return no;
  return Response.json({
    settings: await getSettings(),
    storage: { usedBytes: await storageUsedBytes(), capBytes: storageCapBytes() },
  });
}

export async function PATCH(req: Request) {
  const no = await guard();
  if (no) return no;
  const patch = await req.json().catch(() => ({}));
  if (typeof patch.activePlaylistId === 'string') {
    const exists = await q('SELECT 1 FROM playlists WHERE id = $1', [patch.activePlaylistId]);
    if (!exists.length) return Response.json({ error: 'Playlist not found.' }, { status: 400 });
  }
  return Response.json({ settings: await updateSettings(patch) });
}
