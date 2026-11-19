import { randomBytes, randomInt } from 'node:crypto';
import { getKv, getSettings, setKv } from './store';

/** A TV waiting to be connected: it shows `code`, the owner types it into Settings. */
type Pairing = { id: string; code: string; expires: number; approved: boolean };

const TTL_MS = 10 * 60 * 1000;
const MAX_PENDING = 20;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/I)

async function load(): Promise<Pairing[]> {
  const now = Date.now();
  return (await getKv<Pairing[]>('pairings', [])).filter((p) => p.expires > now);
}

export async function startPairing(): Promise<{ id: string; code: string; expiresInSec: number }> {
  const list = (await load()).slice(-(MAX_PENDING - 1));
  let code = '';
  do {
    code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  } while (list.some((p) => p.code === code));
  const id = randomBytes(24).toString('base64url');
  list.push({ id, code, expires: Date.now() + TTL_MS, approved: false });
  await setKv('pairings', list);
  return { id, code, expiresInSec: TTL_MS / 1000 };
}

/** Polled by the waiting TV. Hands over the device token once the owner approved the code. */
export async function pairingStatus(id: string): Promise<{ state: 'pending' | 'expired' } | { state: 'approved'; device: string }> {
  const list = await load();
  const p = list.find((x) => x.id === id);
  if (!p) return { state: 'expired' };
  if (!p.approved) return { state: 'pending' };
  await setKv('pairings', list.filter((x) => x.id !== id));
  return { state: 'approved', device: (await getSettings()).deviceToken };
}

/** Called by the signed-in owner with the code shown on the TV. */
export async function approvePairing(code: string): Promise<boolean> {
  const list = await load();
  const wanted = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const p = list.find((x) => x.code === wanted);
  if (!p) return false;
  p.approved = true;
  await setKv('pairings', list);
  return true;
}
