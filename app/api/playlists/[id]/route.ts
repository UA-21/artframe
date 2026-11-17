import { guard } from '@/lib/auth';
import { q } from '@/lib/db';
import { bumpVersion, getSettings, toImage, updateSettings } from '@/lib/store';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const no = await guard();
  if (no) return no;
  const { id } = await params;
  const pl = await q('SELECT id, name FROM playlists WHERE id = $1', [id]);
  if (!pl.length) return Response.json({ error: 'Not found.' }, { status: 404 });
  const items = await q(
    `SELECT i.* FROM playlist_items p JOIN images i ON i.id = p.image_id
     WHERE p.playlist_id = $1 ORDER BY p.position`,
    [id],
  );
  return Response.json({ ...pl[0], items: items.map(toImage) });
}

/** Rename and/or replace the ordered list of images: { name?, imageIds? } */
export async function PATCH(req: Request, { params }: Ctx) {
  const no = await guard();
  if (no) return no;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  if (!(await q('SELECT 1 FROM playlists WHERE id = $1', [id])).length) {
    return Response.json({ error: 'Not found.' }, { status: 404 });
  }
  if (typeof b.name === 'string' && b.name.trim()) {
    await q('UPDATE playlists SET name = $2 WHERE id = $1', [id, b.name.trim().slice(0, 80)]);
  }
  if (Array.isArray(b.imageIds)) {
    const ids = [...new Set(b.imageIds.filter((x: unknown) => typeof x === 'string'))] as string[];
    await q('DELETE FROM playlist_items WHERE playlist_id = $1', [id]);
    for (let i = 0; i < ids.length; i++) {
      await q(
        `INSERT INTO playlist_items (playlist_id, image_id, position)
         SELECT $1, id, $3 FROM images WHERE id = $2`,
        [id, ids[i], i + 1],
      );
    }
  }
  await bumpVersion();
  return Response.json({ ok: true });
}

/** Append one image: { imageId } */
export async function POST(req: Request, { params }: Ctx) {
  const no = await guard();
  if (no) return no;
  const { id } = await params;
  const { imageId } = await req.json().catch(() => ({}));
  await q(
    `INSERT INTO playlist_items (playlist_id, image_id, position)
     SELECT p.id, i.id, (SELECT COALESCE(MAX(position), 0) + 1 FROM playlist_items WHERE playlist_id = $1)
     FROM playlists p, images i WHERE p.id = $1 AND i.id = $2
     ON CONFLICT DO NOTHING`,
    [id, String(imageId)],
  );
  await bumpVersion();
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const no = await guard();
  if (no) return no;
  const { id } = await params;
  await q('DELETE FROM playlists WHERE id = $1', [id]);
  if ((await getSettings()).activePlaylistId === id) await updateSettings({ activePlaylistId: null });
  else await bumpVersion();
  return Response.json({ ok: true });
}
