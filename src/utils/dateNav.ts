import { format, addDays, parseISO, differenceInCalendarDays } from 'date-fns';

export const PAST_DAYS_LIMIT = 30;
export const FUTURE_DAYS_LIMIT = 7;

function todayString() {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Applies a day delta to `current`, clamped to [-PAST_DAYS_LIMIT, +FUTURE_DAYS_LIMIT]
 * from `today`. Returns `current` unchanged if the delta would cross a bound.
 * Shared by TodayScreen's nav-arrow buttons and swipe gesture so the clamping
 * logic only lives in one place.
 */
export function clampDate(current: string, delta: number, today: string = todayString()): string {
  const next = format(addDays(parseISO(current), delta), 'yyyy-MM-dd');
  const diff = differenceInCalendarDays(parseISO(next), parseISO(today));
  if (diff > FUTURE_DAYS_LIMIT || diff < -PAST_DAYS_LIMIT) return current;
  return next;
}
