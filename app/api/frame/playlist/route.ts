import { frameAuth } from '@/lib/frame-auth';
import { BLOB_ROUTE } from '@/lib/storage';
import { activeImages, getState } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Everything the TV needs to run the slideshow on its own. */
export async function GET(req: Request) {
  const settings = await frameAuth(req);
  if (settings instanceof Response) return settings;
  const [state, images] = await Promise.all([getState(), activeImages(settings)]);
  const { deviceToken, activePlaylistId: _p, ...display } = settings;
  // Uploaded images are private: the TV proves who it is with its device token.
  const sign = (url: string) => (url.startsWith(BLOB_ROUTE) ? `${url}?device=${encodeURIComponent(deviceToken)}` : url);
  return Response.json(
    {
      version: state.version,
      settings: display,
      items: images.map((i) => ({
        id: i.id,
        url: sign(i.url),
        title: i.title,
        artist: i.artist,
        date: i.date,
        fit: i.fit,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
