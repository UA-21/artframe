import fs from 'node:fs/promises';
import { localBlobPath } from '@/lib/storage';

/** Serves uploaded files in local development (production uses Vercel Blob URLs directly). */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL) return new Response('Not found', { status: 404 });
  try {
    const data = await fs.readFile(localBlobPath((await params).path.join('/')));
    return new Response(new Uint8Array(data), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
