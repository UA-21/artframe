import { guard } from '@/lib/auth';
import { searchArtic, searchMet } from '@/lib/sources';

export async function GET(req: Request) {
  const no = await guard();
  if (no) return no;
  const sp = new URL(req.url).searchParams;
  const query = (sp.get('q') || '').trim().slice(0, 100);
  if (!query) return Response.json([]);
  try {
    return Response.json(await (sp.get('source') === 'met' ? searchMet(query) : searchArtic(query)));
  } catch (e) {
    return Response.json({ error: `Museum search failed: ${(e as Error).message}` }, { status: 502 });
  }
}
