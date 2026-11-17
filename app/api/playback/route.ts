import { guard } from '@/lib/auth';
import { patchState } from '@/lib/store';

/** { action: 'next' | 'prev' | 'pause' | 'play' } — picked up by the TV on its next poll. */
export async function POST(req: Request) {
  const no = await guard();
  if (no) return no;
  const { action } = await req.json().catch(() => ({}));
  if (!['next', 'prev', 'pause', 'play'].includes(action)) {
    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  }
  const state = await patchState((s) => {
    if (action === 'pause') s.paused = true;
    else if (action === 'play') s.paused = false;
    else {
      s.cmdSeq++;
      s.cmdType = action;
    }
  });
  return Response.json({ paused: state.paused });
}
