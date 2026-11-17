import { frameAuth } from '@/lib/frame-auth';
import { activeImages, getState } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Everything the TV needs to run the slideshow on its own. */
export async function GET(req: Request) {
  const settings = await frameAuth(req);
  if (settings instanceof Response) return settings;
  const [state, images] = await Promise.all([getState(), activeImages(settings)]);
  const { deviceToken: _t, activePlaylistId: _p, ...display } = settings;
  return Response.json(
    {
      version: state.version,
      settings: display,
      items: images.map((i) => ({
        id: i.id,
        url: i.url,
        title: i.title,
        artist: i.artist,
        date: i.date,
        fit: i.fit,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
