import { isAdmin, safeEqual } from '@/lib/auth';
import { getBlob } from '@/lib/storage';
import { getSettings } from '@/lib/store';

/** Serves uploaded images to the signed-in owner (cookie) or the paired TV (?device= token). */
export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!(await isAdmin())) {
    const token = new URL(req.url).searchParams.get('device') || '';
    if (!token || !safeEqual(token, (await getSettings()).deviceToken)) {
      return new Response('Unauthorized', { status: 401 });
    }
  }
  const name = (await params).path.join('/');
  if (!/^art\/[0-9a-f-]+(-thumb)?\.jpg$/.test(name)) return new Response('Not found', { status: 404 });
  const blob = await getBlob(name);
  if (!blob) return new Response('Not found', { status: 404 });
  return new Response(blob.body, {
    headers: { 'Content-Type': blob.contentType, 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
}
