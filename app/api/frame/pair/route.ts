import { pairingStatus, startPairing } from '@/lib/pairing';

export const dynamic = 'force-dynamic';
const noStore = { headers: { 'Cache-Control': 'no-store' } };

/** A TV without a device token asks for a code to show on screen. */
export async function POST() {
  return Response.json(await startPairing(), noStore);
}

/** The waiting TV polls until the owner has entered its code. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id') || '';
  return Response.json(await pairingStatus(id), noStore);
}
