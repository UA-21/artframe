import { guard } from '@/lib/auth';
import { q } from '@/lib/db';
import { delBlob } from '@/lib/storage';
import { bumpVersion, toImage } from '@/lib/store';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const no = await guard();
  if (no) return no;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const rows = await q('SELECT * FROM images WHERE id = $1', [id]);
  if (!rows.length) return Response.json({ error: 'Not found.' }, { status: 404 });
  const cur = rows[0];
  const str = (v: unknown, old: string) => (typeof v === 'string' ? v.trim().slice(0, 300) : old);
  const fit = b.fit === 'contain' || b.fit === 'cover' ? b.fit : b.fit === null ? null : cur.fit;
  const updated = await q(
    'UPDATE images SET title = $2, artist = $3, date_text = $4, fit = $5 WHERE id = $1 RETURNING *',
    [id, str(b.title, cur.title), str(b.artist, cur.artist), str(b.date, cur.date_text), fit],
  );
  await bumpVersion();
  return Response.json(toImage(updated[0]));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const no = await guard();
  if (no) return no;
  const { id } = await params;
  const rows = await q('DELETE FROM images WHERE id = $1 RETURNING *', [id]);
  if (rows.length && rows[0].source === 'upload') {
    await delBlob(rows[0].url);
    await delBlob(rows[0].thumb_url);
  }
  await bumpVersion();
  return Response.json({ ok: true });
}
