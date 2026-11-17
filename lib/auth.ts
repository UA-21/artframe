import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'af_session';
const SESSION_DAYS = 90;

/** The admin password, or null if none is configured (login is then refused in production). */
export function adminPassword(): string | null {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  return process.env.NODE_ENV === 'production' ? null : 'artframe';
}

function secret(): string {
  return process.env.AUTH_SECRET || createHash('sha256').update('artframe:' + (adminPassword() ?? '')).digest('hex');
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}

export function makeSession(): { value: string; maxAge: number } {
  const maxAge = SESSION_DAYS * 86400;
  const exp = String(Date.now() + maxAge * 1000);
  return { value: `${exp}.${sign(exp)}`, maxAge };
}

export function verifySession(value: string | undefined): boolean {
  if (!value || !adminPassword()) return false;
  const [exp, mac] = value.split('.');
  if (!exp || !mac || !safeEqual(mac, sign(exp))) return false;
  return Number(exp) > Date.now();
}

export async function isAdmin(): Promise<boolean> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Returns a 401 response when the caller is not logged in, otherwise null. */
export async function guard(): Promise<Response | null> {
  return (await isAdmin()) ? null : Response.json({ error: 'unauthorized' }, { status: 401 });
}
