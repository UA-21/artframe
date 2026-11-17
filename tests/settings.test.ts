import { describe, expect, it } from 'vitest';
import { isDisplayOn, sanitizeSettings } from '../lib/settings';

const sched = (onTime: string, offTime: string, timezone = 'UTC') => ({ scheduleEnabled: true, onTime, offTime, timezone });
const at = (iso: string) => new Date(iso);

describe('isDisplayOn', () => {
  it('is always on when the schedule is disabled', () => {
    expect(isDisplayOn(at('2026-01-01T03:00:00Z'), { ...sched('08:00', '23:00'), scheduleEnabled: false })).toBe(true);
  });
  it('handles a daytime range', () => {
    const s = sched('08:00', '23:00');
    expect(isDisplayOn(at('2026-01-01T07:59:00Z'), s)).toBe(false);
    expect(isDisplayOn(at('2026-01-01T08:00:00Z'), s)).toBe(true);
    expect(isDisplayOn(at('2026-01-01T22:59:00Z'), s)).toBe(true);
    expect(isDisplayOn(at('2026-01-01T23:00:00Z'), s)).toBe(false);
  });
  it('handles a range that crosses midnight', () => {
    const s = sched('18:00', '02:00');
    expect(isDisplayOn(at('2026-01-01T19:00:00Z'), s)).toBe(true);
    expect(isDisplayOn(at('2026-01-01T01:30:00Z'), s)).toBe(true);
    expect(isDisplayOn(at('2026-01-01T02:00:00Z'), s)).toBe(false);
    expect(isDisplayOn(at('2026-01-01T12:00:00Z'), s)).toBe(false);
  });
  it('uses the configured time zone', () => {
    // 06:30 UTC is 08:30 in Jerusalem (UTC+2 in winter)
    expect(isDisplayOn(at('2026-01-01T06:30:00Z'), sched('08:00', '23:00', 'Asia/Jerusalem'))).toBe(true);
    expect(isDisplayOn(at('2026-01-01T06:30:00Z'), sched('08:00', '23:00', 'UTC'))).toBe(false);
  });
  it('treats equal on/off times as always on', () => {
    expect(isDisplayOn(at('2026-01-01T03:00:00Z'), sched('08:00', '08:00'))).toBe(true);
  });
});

describe('sanitizeSettings', () => {
  it('clamps numbers and drops invalid or unknown values', () => {
    expect(
      sanitizeSettings({
        intervalSec: 1,
        brightness: 500,
        matWidth: -3,
        fit: 'stretch',
        matColor: 'red',
        onTime: '25:00',
        timezone: 'Mars/Olympus',
        deviceToken: 'hijack',
        shuffle: 'yes',
      }),
    ).toEqual({ intervalSec: 10, brightness: 100, matWidth: 0 });
  });
  it('keeps valid values', () => {
    const patch = { fit: 'cover', matColor: '#aabbcc', offTime: '22:30', timezone: 'Europe/Paris', shuffle: true, activePlaylistId: null };
    expect(sanitizeSettings(patch)).toEqual(patch);
  });
});
