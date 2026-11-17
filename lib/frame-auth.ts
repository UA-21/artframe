import { safeEqual } from './auth';
import { getSettings } from './store';
import type { Settings } from './settings';

/** Validates the TV's device token. Returns settings, or a 401 response. */
export async function frameAuth(req: Request): Promise<Settings | Response> {
  const token = new URL(req.url).searchParams.get('device') || '';
  const settings = await getSettings();
  if (!token || !safeEqual(token, settings.deviceToken)) {
    return Response.json({ error: 'unknown device' }, { status: 401 });
  }
  return settings;
}
