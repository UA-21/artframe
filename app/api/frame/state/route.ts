import { frameAuth } from '@/lib/frame-auth';
import { isDisplayOn } from '@/lib/settings';
import { getState, setKv } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Polled by the TV every few seconds. Small on purpose. */
export async function GET(req: Request) {
  const settings = await frameAuth(req);
  if (settings instanceof Response) return settings;
  const current = new URL(req.url).searchParams.get('current') || null;
  const [state] = await Promise.all([getState(), setKv('presence', { currentImageId: current, lastSeen: Date.now() })]);
  return Response.json(
    {
      version: state.version,
      paused: state.paused,
      cmdSeq: state.cmdSeq,
      cmdType: state.cmdType,
      off: !isDisplayOn(new Date(), settings),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
