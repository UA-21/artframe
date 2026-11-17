import { adminPassword } from '@/lib/auth';
import { databaseUrl, q } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Setup diagnostics: says which pieces are configured. Never returns values, only names and yes/no. */
export async function GET() {
  let database = 'ok';
  try {
    await q('SELECT 1');
  } catch (e) {
    // Trim and strip anything that could look like a connection string.
    database = 'error: ' + String((e as Error).message).replace(/\S+:\/\/\S+/g, '[url]').slice(0, 160);
  }
  const env = process.env;
  return Response.json(
    {
      adminPassword: !!adminPassword(),
      databaseConfigured: !!databaseUrl(),
      database,
      blobConfigured: !!(env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID),
      relatedVariableNames: Object.keys(env)
        .filter((k) => /DATABASE|POSTGRES|NEON|^PG|BLOB/.test(k))
        .sort(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
