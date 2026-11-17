import { randomUUID } from 'node:crypto';
import { guard } from '@/lib/auth';
import { q } from '@/lib/db';

export async function GET() {
  const no = await guard();
  if (no) return no;
  const rows = await q(
    `SELECT p.id, p.name, COUNT(i.image_id) AS count
     FROM playlists p LEFT JOIN playlist_items i ON i.playlist_id = p.id
     GROUP BY p.id, p.name, p.created_at ORDER BY p.created_at`,
  );
  return Response.json(rows.map((r) => ({ id: r.id, name: r.name, count: Number(r.count) })));
}

export async function POST(req: Request) {
  const no = await guard();
  if (no) return no;
  const { name } = await req.json().catch(() => ({}));
  if (typeof name !== 'string' || !name.trim()) return Response.json({ error: 'Name is required.' }, { status: 400 });
  const id = randomUUID();
  await q('INSERT INTO playlists (id, name, created_at) VALUES ($1, $2, $3)', [
    id,
    name.trim().slice(0, 80),
    new Date().toISOString(),
  ]);
  return Response.json({ id, name: name.trim().slice(0, 80), count: 0 });
}
