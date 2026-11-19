import { guard } from '@/lib/auth';
import { approvePairing } from '@/lib/pairing';

/** { code } — connect the TV that is showing this code. */
export async function POST(req: Request) {
  const no = await guard();
  if (no) return no;
  const { code } = await req.json().catch(() => ({}));
  if (typeof code !== 'string' || !(await approvePairing(code))) {
    return Response.json({ error: 'Code not found. Check the code on the TV; it changes every 10 minutes.' }, { status: 404 });
  }
  return Response.json({ ok: true });
}
