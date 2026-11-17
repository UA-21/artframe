import fs from 'node:fs/promises';
import path from 'node:path';
import { dataDir } from './db';

const LOCAL_PREFIX = '/api/local-blob/';
const useVercelBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

/** Store a file and return the URL it can be loaded from. */
export async function putBlob(name: string, data: Buffer, contentType: string): Promise<string> {
  if (useVercelBlob()) {
    const { put } = await import('@vercel/blob');
    const res = await put(name, data, { access: 'public', contentType, addRandomSuffix: false });
    return res.url;
  }
  if (process.env.VERCEL) throw new Error('BLOB_READ_WRITE_TOKEN is not set: connect a Blob store to this project.');
  const file = path.join(dataDir('blobs'), name);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
  return LOCAL_PREFIX + name;
}

export async function delBlob(url: string): Promise<void> {
  try {
    if (url.startsWith(LOCAL_PREFIX)) {
      await fs.unlink(localBlobPath(url.slice(LOCAL_PREFIX.length)));
    } else if (useVercelBlob() && url.includes('.blob.vercel-storage.com/')) {
      const { del } = await import('@vercel/blob');
      await del(url);
    }
  } catch {
    // Already gone: nothing to clean up.
  }
}

/** Resolve a local blob name to a file path, refusing anything outside the blob directory. */
export function localBlobPath(name: string): string {
  const root = dataDir('blobs');
  const file = path.resolve(root, name);
  if (!file.startsWith(root + path.sep)) throw new Error('bad path');
  return file;
}
