import { addDays, format } from 'date-fns';
import { getTodaysReadings } from './completions';
import type { ReminderItem } from './notifications';

// How far ahead reminders are scheduled. They only reach this far if the app
// isn't opened again, since every foreground on a new day rolls the window.
export const REMINDER_WINDOW_DAYS = 14;

/**
 * The readings that should get a reminder over the next `days` days (today
 * included): every group's reading for each date, minus readings already marked
 * complete and dates with no reading. If any lookup fails the whole call
 * rejects, so a flaky connection never replaces a good schedule with a
 * partial one.
 */
export async function getUpcomingReminders(
  userId: string,
  timezone: string,
  from: Date = new Date(),
  days: number = REMINDER_WINDOW_DAYS
): Promise<ReminderItem[]> {
  const dates = Array.from({ length: days }, (_, i) => format(addDays(from, i), 'yyyy-MM-dd'));

  const perDate = await Promise.all(
    dates.map(async (date) => ({ date, readings: await getTodaysReadings(userId, timezone, date) }))
  );

  return perDate.flatMap(({ date, readings }) =>
    readings
      .filter((reading) => !reading.completed && reading.passages.length > 0)
      .map((reading) => ({
        groupId: reading.group.id,
        groupName: reading.group.name,
        date,
        passages: reading.passages,
      }))
  );
}
