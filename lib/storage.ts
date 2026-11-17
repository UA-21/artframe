import fs from 'node:fs/promises';
import path from 'node:path';
import { dataDir } from './db';

/** Uploaded files are never public: they are served through this authenticated route. */
export const BLOB_ROUTE = '/api/blob/';

const useVercelBlob = () =>
  !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID || process.env.VERCEL);

/** Store a file and return the (authenticated) URL it can be loaded from. */
export async function putBlob(name: string, data: Buffer, contentType: string): Promise<string> {
  if (useVercelBlob()) {
    const { put } = await import('@vercel/blob');
    await put(name, data, { access: 'private', contentType, addRandomSuffix: false });
  } else {
    const file = localBlobPath(name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  }
  return BLOB_ROUTE + name;
}

/** Read a stored file, or null when it does not exist. */
export async function getBlob(name: string): Promise<{ body: BodyInit; contentType: string } | null> {
  if (useVercelBlob()) {
    const { get } = await import('@vercel/blob');
    const res = await get(name, { access: 'private' });
    if (!res || res.statusCode !== 200) return null;
    return { body: res.stream, contentType: res.blob.contentType };
  }
  try {
    return { body: new Uint8Array(await fs.readFile(localBlobPath(name))), contentType: 'image/jpeg' };
  } catch {
    return null;
  }
}

export async function delBlob(url: string): Promise<void> {
  if (!url.startsWith(BLOB_ROUTE)) return;
  const name = url.slice(BLOB_ROUTE.length);
  try {
    if (useVercelBlob()) {
      const { del } = await import('@vercel/blob');
      await del(name);
    } else {
      await fs.unlink(localBlobPath(name));
    }
  } catch {
    // Already gone: nothing to clean up.
  }
}

/** Resolve a local blob name to a file path, refusing anything outside the blob directory. */
function localBlobPath(name: string): string {
  const root = dataDir('blobs');
  const file = path.resolve(root, name);
  if (!file.startsWith(root + path.sep)) throw new Error('bad path');
  return file;
}
