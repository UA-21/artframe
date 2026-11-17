import fs from 'node:fs';
import path from 'node:path';

export type Row = Record<string, any>;
type Runner = (sql: string, params?: unknown[]) => Promise<Row[]>;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS images (
    id text PRIMARY KEY,
    source text NOT NULL,
    title text NOT NULL DEFAULT '',
    artist text NOT NULL DEFAULT '',
    date_text text NOT NULL DEFAULT '',
    credit text NOT NULL DEFAULT '',
    url text NOT NULL,
    thumb_url text NOT NULL,
    width integer,
    height integer,
    bytes integer NOT NULL DEFAULT 0,
    fit text,
    created_at text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS playlists (
    id text PRIMARY KEY,
    name text NOT NULL,
    created_at text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS playlist_items (
    playlist_id text NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    image_id text NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    position integer NOT NULL,
    PRIMARY KEY (playlist_id, image_id)
  )`,
  `CREATE TABLE IF NOT EXISTS kv (key text PRIMARY KEY, value jsonb NOT NULL)`,
];

/** Directory for local development data (embedded database + uploaded files). */
export function dataDir(sub: string): string {
  const dir = path.join(process.env.ARTFRAME_DATA_DIR || path.join(process.cwd(), '.data'), sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Connection string from the environment. Also accepts prefixed names (e.g. STORAGE_DATABASE_URL). */
export function databaseUrl(): string | undefined {
  const env = process.env;
  if (env.DATABASE_URL || env.POSTGRES_URL) return env.DATABASE_URL || env.POSTGRES_URL;
  const key = Object.keys(env).find((k) => /_(DATABASE|POSTGRES)_URL$/.test(k) && env[k]?.startsWith('postgres'));
  return key ? env[key] : undefined;
}

async function create(): Promise<Runner> {
  let run: Runner;
  const url = databaseUrl();
  if (url) {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    run = async (text, params = []) => (await sql.query(text, params as any[])) as Row[];
  } else {
    if (process.env.VERCEL) throw new Error('DATABASE_URL is not set: connect a Postgres database to this project.');
    // Local development / tests: embedded Postgres (PGlite) stored on disk.
    const { PGlite } = await import('@electric-sql/pglite');
    const pg = new PGlite(dataDir('pg'));
    run = async (text, params = []) => (await pg.query(text, params as any[])).rows as Row[];
  }
  for (const stmt of SCHEMA) await run(stmt);
  return run;
}

const g = globalThis as { __artframeDb?: Promise<Runner> };

export async function q(sql: string, params: unknown[] = []): Promise<Row[]> {
  if (!g.__artframeDb) {
    g.__artframeDb = create().catch((e) => {
      g.__artframeDb = undefined;
      throw e;
    });
  }
  return (await g.__artframeDb)(sql, params);
}
