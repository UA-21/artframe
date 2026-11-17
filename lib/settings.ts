// Pure settings + schedule logic (no database access) so it can be unit-tested.

export type Fit = 'contain' | 'cover';

export type Settings = {
  intervalSec: number;
  shuffle: boolean;
  activePlaylistId: string | null;
  fit: Fit;
  matWidth: number; // percent of screen height, 0 = no mat
  matColor: string;
  showCaption: boolean;
  motion: boolean;
  brightness: number; // 20..100
  scheduleEnabled: boolean;
  onTime: string; // HH:MM
  offTime: string; // HH:MM
  timezone: string;
  deviceToken: string;
};

export const DEFAULT_SETTINGS: Settings = {
  intervalSec: 120,
  shuffle: false,
  activePlaylistId: null,
  fit: 'contain',
  matWidth: 0,
  matColor: '#2b2a27',
  showCaption: true,
  motion: true,
  brightness: 100,
  scheduleEnabled: false,
  onTime: '08:00',
  offTime: '23:00',
  timezone: 'UTC',
  deviceToken: '',
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Keep only known keys with valid values. Unknown or invalid entries are dropped. */
export function sanitizeSettings(patch: Record<string, unknown>): Partial<Settings> {
  const out: Partial<Settings> = {};
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  let n: number | null;
  if ((n = num(patch.intervalSec)) !== null) out.intervalSec = Math.round(clamp(n, 10, 86400));
  if ((n = num(patch.matWidth)) !== null) out.matWidth = clamp(n, 0, 20);
  if ((n = num(patch.brightness)) !== null) out.brightness = Math.round(clamp(n, 20, 100));
  for (const k of ['shuffle', 'showCaption', 'motion', 'scheduleEnabled'] as const) {
    if (typeof patch[k] === 'boolean') out[k] = patch[k] as boolean;
  }
  if (patch.fit === 'contain' || patch.fit === 'cover') out.fit = patch.fit;
  if (typeof patch.matColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(patch.matColor)) out.matColor = patch.matColor;
  if (typeof patch.onTime === 'string' && TIME_RE.test(patch.onTime)) out.onTime = patch.onTime;
  if (typeof patch.offTime === 'string' && TIME_RE.test(patch.offTime)) out.offTime = patch.offTime;
  if (typeof patch.timezone === 'string' && isValidTimezone(patch.timezone)) out.timezone = patch.timezone;
  if (patch.activePlaylistId === null || typeof patch.activePlaylistId === 'string') {
    out.activePlaylistId = patch.activePlaylistId as string | null;
  }
  return out;
}

function minutesInZone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Should the frame be showing art right now? Handles overnight ranges (e.g. 18:00-02:00). */
export function isDisplayOn(
  now: Date,
  s: Pick<Settings, 'scheduleEnabled' | 'onTime' | 'offTime' | 'timezone'>,
): boolean {
  if (!s.scheduleEnabled) return true;
  const on = toMin(s.onTime);
  const off = toMin(s.offTime);
  if (on === off) return true;
  const m = minutesInZone(now, s.timezone);
  return on < off ? m >= on && m < off : m >= on || m < off;
}
