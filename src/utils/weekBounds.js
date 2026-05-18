import { DateTime } from 'luxon';
import { env } from '../config/env.js';

// Calculate the start (Monday) and end (Sunday night) of a draw week using standard timezone bounds.
export function getDrawWeekBounds(reference = Date.now()) {
  const zone = env.WEEKLY_DRAW_TIMEZONE;
  const dt = DateTime.fromMillis(typeof reference === 'number' ? reference : reference.getTime(), {
    zone,
  }).setLocale('en-GB');
  const weekStart = dt.startOf('week'); // Monday (en-GB week)
  const weekEnd = weekStart.plus({ days: 6 }).endOf('day');
  return {
    weekStart: weekStart.toJSDate(),
    weekEnd: weekEnd.toJSDate(),
    weekKey: weekStart.toISODate(),
  };
}
