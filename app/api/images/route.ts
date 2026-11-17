import { randomUUID } from 'node:crypto';
import { guard } from '@/lib/auth';
import { q } from '@/lib/db';
import { IMAGE_HOSTS } from '@/lib/sources';
import { putBlob } from '@/lib/storage';
import { bumpVersion, storageCapBytes, storageUsedBytes, toImage } from '@/lib/store';

const MAX_UPLOAD_BYTES = 4.4 * 1024 * 1024; // Vercel request body limit is 4.5 MB

export async function GET() {
  const no = await guard();
  if (no) return no;
  return Response.json((await q('SELECT * FROM images ORDER BY created_at DESC')).map(toImage));
}

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function addToPlaylist(playlistId: unknown, imageId: string) {
  if (typeof playlistId !== 'string' || !playlistId) return;
  await q(
    `INSERT INTO playlist_items (playlist_id, image_id, position)
     SELECT id, $2, (SELECT COALESCE(MAX(position), 0) + 1 FROM playlist_items WHERE playlist_id = $1)
     FROM playlists WHERE id = $1
     ON CONFLICT DO NOTHING`,
    [playlistId, imageId],
  );
}

export async function POST(req: Request) {
  const no = await guard();
  if (no) return no;
  const id = randomUUID();
  const now = new Date().toISOString();

  // Museum import: JSON body with remote image URLs (nothing is copied).
  if (req.headers.get('content-type')?.includes('application/json')) {
    const b = await req.json().catch(() => ({}));
    const ok = (u: unknown) => {
      try {
        const url = new URL(String(u));
        return url.protocol === 'https:' && IMAGE_HOSTS.includes(url.host);
      } catch {
        return false;
      }
    };
    if (!ok(b.url) || !ok(b.thumbUrl) || (b.source !== 'artic' && b.source !== 'met')) {
      return Response.json({ error: 'Unsupported image source.' }, { status: 400 });
    }
    const existing = await q('SELECT * FROM images WHERE url = $1', [b.url]);
    const imageId = existing.length ? existing[0].id : id;
    if (!existing.length) {
      await q(
        `INSERT INTO images (id, source, title, artist, date_text, credit, url, thumb_url, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, b.source, str(b.title), str(b.artist), str(b.date), str(b.credit), b.url, b.thumbUrl, now],
      );
    }
    await addToPlaylist(b.playlistId, imageId);
    await bumpVersion();
    return Response.json(toImage((await q('SELECT * FROM images WHERE id = $1', [imageId]))[0]));
  }

  // Upload: multipart with an already-resized JPEG and a thumbnail (done in the browser).
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const thumb = form?.get('thumb');
  if (!(file instanceof Blob) || !(thumb instanceof Blob)) {
    return Response.json({ error: 'Expected "file" and "thumb" image parts.' }, { status: 400 });
  }
  const bytes = file.size + thumb.size;
  if (bytes > MAX_UPLOAD_BYTES) return Response.json({ error: 'Image is too large.' }, { status: 413 });
  if (!file.type.startsWith('image/') || !thumb.type.startsWith('image/')) {
    return Response.json({ error: 'Only images can be uploaded.' }, { status: 400 });
  }
  if ((await storageUsedBytes()) + bytes > storageCapBytes()) {
    return Response.json({ error: 'Storage is full. Delete some images first.' }, { status: 507 });
  }
  const url = await putBlob(`art/${id}.jpg`, Buffer.from(await file.arrayBuffer()), 'image/jpeg');
  const thumbUrl = await putBlob(`art/${id}-thumb.jpg`, Buffer.from(await thumb.arrayBuffer()), 'image/jpeg');
  const int = (k: string) => parseInt(String(form!.get(k)), 10) || null;
  await q(
    `INSERT INTO images (id, source, title, url, thumb_url, width, height, bytes, created_at)
     VALUES ($1, 'upload', $2, $3, $4, $5, $6, $7, $8)`,
    [id, str(form!.get('title')), url, thumbUrl, int('width'), int('height'), bytes, now],
  );
  await addToPlaylist(form!.get('playlistId'), id);
  await bumpVersion();
  return Response.json(toImage((await q('SELECT * FROM images WHERE id = $1', [id]))[0]));
}
