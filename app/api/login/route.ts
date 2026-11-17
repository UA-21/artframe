import { cookies } from 'next/headers';
import { adminPassword, makeSession, safeEqual, SESSION_COOKIE } from '@/lib/auth';
import { getKv, setKv } from '@/lib/store';

const MAX_FAILS = 5;
const LOCK_MS = 5 * 60 * 1000;

export async function POST(req: Request) {
  const expected = adminPassword();
  if (!expected) return Response.json({ error: 'ADMIN_PASSWORD is not configured on the server.' }, { status: 503 });

  const lock = await getKv('login', { fails: 0, lockedUntil: 0 });
  if (lock.lockedUntil > Date.now()) {
    return Response.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
  }

  const { password } = await req.json().catch(() => ({}));
  if (typeof password !== 'string' || !safeEqual(password, expected)) {
    const fails = lock.fails + 1;
    await setKv('login', fails >= MAX_FAILS ? { fails: 0, lockedUntil: Date.now() + LOCK_MS } : { fails, lockedUntil: 0 });
    return Response.json({ error: 'Wrong password.' }, { status: 401 });
  }

  if (lock.fails) await setKv('login', { fails: 0, lockedUntil: 0 });
  const session = makeSession();
  (await cookies()).set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && !process.env.ARTFRAME_INSECURE_COOKIE,
    maxAge: session.maxAge,
    path: '/',
  });
  return Response.json({ ok: true });
}
