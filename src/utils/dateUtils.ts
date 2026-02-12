import { differenceInDays, format, parseISO, isToday, startOfDay, isSameDay } from 'date-fns';

/**
 * Calculate current day number based on start date
 * @param startDate ISO date string when plan was started
 * @returns Current day number (1-indexed)
 */
export function calculateCurrentDay(startDate: string): number {
  const start = parseISO(startDate);
  const today = startOfDay(new Date());
  const daysPassed = differenceInDays(today, start);
  return daysPassed + 1; // Day 1, not Day 0
}

/**
 * Calculate current and longest streak from completed dates
 * @param completedDates Array of ISO date strings
 * @param lastReadingDate Last reading date (optional, for optimization)
 * @returns Object with current and longest streak
 */
export function calculateStreak(
  completedDates: string[],
  lastReadingDate: string | null
): { current: number; longest: number } {
  if (completedDates.length === 0) {
    return { current: 0, longest: 0 };
  }

  // Sort dates in descending order
  const sortedDates = completedDates
    .map((d) => startOfDay(parseISO(d)))
    .sort((a, b) => b.getTime() - a.getTime());

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const today = startOfDay(new Date());
  const yesterday = startOfDay(new Date());
  yesterday.setDate(yesterday.getDate() - 1);

  // Check if last reading was today or yesterday to maintain streak
  const lastReading = sortedDates[0];
  const daysDiff = differenceInDays(today, lastReading);

  if (daysDiff === 0 || daysDiff === 1) {
    currentStreak = 1;

    // Count consecutive days backwards
    for (let i = 1; i < sortedDates.length; i++) {
      const diff = differenceInDays(sortedDates[i - 1], sortedDates[i]);
      if (diff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  tempStreak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = differenceInDays(sortedDates[i - 1], sortedDates[i]);
    if (diff === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak, currentStreak);

  return { current: currentStreak, longest: longestStreak };
}

/**
 * Format date for user-friendly display
 * @param date ISO date string or Date object
 * @returns Formatted date string (e.g., "January 1, 2024")
 */
export function formatDateForDisplay(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMMM d, yyyy');
}

/**
 * Check if a given date is today
 * @param readingDate ISO date string
 * @returns True if date is today
 */
export function isReadingForToday(readingDate: string): boolean {
  return isToday(parseISO(readingDate));
}

/**
 * Get today's date as ISO string (start of day)
 * @returns ISO date string for today at 00:00:00
 */
export function getTodaysDateString(): string {
  return startOfDay(new Date()).toISOString();
}

/**
 * Calculate completion percentage
 * @param completedCount Number of completed readings
 * @param totalDays Total days in plan
 * @returns Percentage (0-100)
 */
export function getCompletionPercentage(completedCount: number, totalDays: number): number {
  if (totalDays === 0) return 0;
  return Math.round((completedCount / totalDays) * 100);
}

/**
 * Check if user has completed a reading today
 * @param completedDates Array of ISO date strings
 * @returns True if any reading was completed today
 */
export function hasReadToday(completedDates: string[]): boolean {
  if (completedDates.length === 0) return false;

  const today = startOfDay(new Date());

  return completedDates.some((dateStr) => {
    const completedDate = startOfDay(parseISO(dateStr));
    return isSameDay(completedDate, today);
  });
}

/**
 * Determine if completing a reading should increment the streak
 * @param completedDates Array of ISO date strings
 * @param lastReadingDate Last reading date
 * @returns True if streak should increment
 */
export function shouldIncrementStreak(
  completedDates: string[],
  lastReadingDate: string | null
): boolean {
  // If no reading completed yet, should increment
  if (!lastReadingDate) return true;

  // Check if user has already read today
  if (hasReadToday(completedDates)) {
    return false; // Don't increment if already read today
  }

  return true;
}

/**
 * Format time for notification settings (HH:mm format)
 * @param date Date object
 * @returns Time string in HH:mm format
 */
export function formatTimeForNotification(date: Date): string {
  return format(date, 'HH:mm:ss');
}

/**
 * Parse notification time to Date object for today
 * @param timeString Time string in HH:mm:ss format
 * @returns Date object for today at specified time
 */
export function parseNotificationTime(timeString: string): Date {
  const [hours, minutes, seconds] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, seconds || 0, 0);
  return date;
}
