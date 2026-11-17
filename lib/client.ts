'use client';

/** fetch wrapper for the control UI: JSON in/out, redirects to /login when the session expired. */
export async function api<T = any>(path: string, init?: { method?: string; json?: unknown; form?: FormData }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method || (init?.json !== undefined || init?.form ? 'POST' : 'GET'),
    headers: init?.json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.form ?? (init?.json !== undefined ? JSON.stringify(init.json) : undefined),
  });
  if (res.status === 401 && !path.startsWith('/api/login')) {
    window.location.href = '/login';
    throw new Error('Not logged in');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export type Img = {
  id: string;
  source: string;
  title: string;
  artist: string;
  date: string;
  credit: string;
  url: string;
  thumbUrl: string;
  fit: 'contain' | 'cover' | null;
};

export type Playlist = { id: string; name: string; count: number };

const MAX_EDGE = 3840;
const THUMB_EDGE = 480;
const MAX_BYTES = 3.9 * 1024 * 1024;

function toJpeg(source: CanvasImageSource, w: number, h: number, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(source, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality),
  );
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height };
    } catch {
      // fall through to <img> decoding
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Downscale a photo in the browser (max 4K edge) and build a thumbnail, ready to upload. */
export async function prepareUpload(file: File): Promise<FormData> {
  const { source, width, height } = await decode(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  let full = await toJpeg(source, w, h, 0.86);
  for (const quality of [0.78, 0.68, 0.55]) {
    if (full.size <= MAX_BYTES) break;
    full = await toJpeg(source, w, h, quality);
  }
  const ts = Math.min(1, THUMB_EDGE / Math.max(width, height));
  const thumb = await toJpeg(source, Math.round(width * ts), Math.round(height * ts), 0.8);
  const form = new FormData();
  form.set('file', full, 'image.jpg');
  form.set('thumb', thumb, 'thumb.jpg');
  form.set('width', String(w));
  form.set('height', String(h));
  form.set('title', file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  return form;
}
