import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { format } from 'date-fns';
import { supabase } from './supabase';
import { markComplete } from './completions';

const VIBRATION_PATTERN_MS: number[] = [0, 250, 250, 250];
const ANDROID_CHANNEL_ID = 'default';
// One notification per group per day, id `reading-reminder-<groupId>-<YYYY-MM-DD>`.
const REMINDER_ID_PREFIX = 'reading-reminder-';
const REMINDER_ID_PATTERN = /^reading-reminder-(.+)-(\d{4}-\d{2}-\d{2})$/;
// Ids from earlier versions (a repeating per-group reminder, and before that
// one generic reminder). Still cancelled so an upgraded install doesn't fire
// them alongside the current ones.
const PREVIOUS_REMINDER_ID_PREFIX = 'daily-reminder-';
const LEGACY_REMINDER_ID = 'daily-reading-reminder';
const REMINDER_CATEGORY_ID = 'reading-reminder';

export const MARK_COMPLETE_ACTION_ID = 'mark-complete';

/** One day's reading for one group, to be announced by a reminder. */
export type ReminderItem = {
  groupId: string;
  groupName: string;
  date: string; // YYYY-MM-DD
  passages: string[];
};

function reminderId(groupId: string, date: string): string {
  return `${REMINDER_ID_PREFIX}${groupId}-${date}`;
}

function isReminderId(identifier: string): boolean {
  return (
    identifier === LEGACY_REMINDER_ID ||
    identifier.startsWith(REMINDER_ID_PREFIX) ||
    identifier.startsWith(PREVIOUS_REMINDER_ID_PREFIX)
  );
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Daily Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: VIBRATION_PATTERN_MS,
  });
}

async function ensureReminderCategory(): Promise<void> {
  // opensAppToForeground: false lets the button act without launching the UI.
  await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY_ID, [
    {
      identifier: MARK_COMPLETE_ACTION_ID,
      buttonTitle: 'Mark complete',
      options: { opensAppToForeground: false },
    },
  ]);
}

/** Cancel every reminder this app scheduled (current, previous, and legacy ids). */
export async function cancelReadingReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const { identifier } of scheduled) {
    if (isReminderId(identifier)) {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    }
  }
}

/** Cancel one group's reminder for one date (e.g. once that reading is marked complete). */
export async function cancelReadingReminder(groupId: string, date: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(reminderId(groupId, date));
}

/**
 * Replace all on-device reading reminders with one per group per day for the
 * given readings, each firing at the user's preferred time ("HH:MM" or
 * "HH:MM:SS", device-local). The notification is titled with the group's name,
 * shows that day's passage(s) as its text, and carries a "Mark complete" action
 * for that group and date. Reminders whose time has already passed today are
 * skipped. Runs entirely on the phone via the OS alarm system: no push token,
 * FCM, or server involved, so it also works on emulators. Returns false if
 * notification permission is not granted; throws if the time is malformed.
 */
export async function scheduleReadingReminders(
  preferredTime: string,
  reminders: ReminderItem[]
): Promise<boolean> {
  const [hour, minute] = preferredTime.split(':').map(Number);
  if (
    !Number.isInteger(hour) || !Number.isInteger(minute) ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59
  ) {
    throw new Error(`scheduleReadingReminders: invalid time "${preferredTime}"`);
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return false;
  }

  await ensureAndroidChannel();
  await ensureReminderCategory();

  // Start clean so a changed time, renamed group, changed plan, or left group
  // never leaves a stale reminder behind.
  await cancelReadingReminders();

  const now = Date.now();
  for (const reminder of reminders) {
    const [year, month, day] = reminder.date.split('-').map(Number);
    const fireAt = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (fireAt.getTime() <= now) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: reminderId(reminder.groupId, reminder.date),
      content: {
        title: reminder.groupName,
        body: reminder.passages.join(', '),
        categoryIdentifier: REMINDER_CATEGORY_ID,
        data: {
          type: 'daily_reminder',
          group_id: reminder.groupId,
          reading_date: reminder.date,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        channelId: ANDROID_CHANNEL_ID,
      },
    });
  }
  return true;
}

/**
 * Which group and reading date a reminder is for. The in-app listener
 * delivers the data as an object, but the background task (app closed)
 * delivers it only as a JSON string (`dataString`), so `content.data` can be
 * missing there. The notification id (`reading-reminder-<groupId>-<date>`) is
 * the last resort.
 */
function getReminderTarget(request: Notifications.NotificationRequest): {
  groupId?: string;
  readingDate?: string;
} {
  const sources: Array<Record<string, unknown> | undefined> = [request.content.data];
  const dataString = (request.content as { dataString?: unknown }).dataString;
  if (typeof dataString === 'string') {
    try {
      sources.push(JSON.parse(dataString));
    } catch {
      // fall through to the id
    }
  }
  const read = (key: string): string | undefined => {
    for (const source of sources) {
      const value = source?.[key];
      if (typeof value === 'string') return value;
    }
    return undefined;
  };

  let groupId = read('group_id');
  let readingDate = read('reading_date');
  if (!groupId || !readingDate) {
    const match = REMINDER_ID_PATTERN.exec(request.identifier);
    if (match) {
      groupId ??= match[1];
      readingDate ??= match[2];
    } else if (!groupId && request.identifier.startsWith(PREVIOUS_REMINDER_ID_PREFIX)) {
      groupId = request.identifier.slice(PREVIOUS_REMINDER_ID_PREFIX.length);
    }
  }
  return { groupId, readingDate };
}

/**
 * Handle the user pressing "Mark complete" on a reminder: record the
 * completion for that notification's group and reading date (today, for
 * reminders without a date), then clear it from the tray. Runs from a
 * background task (app closed or backgrounded) as well as from the in-app
 * listener, so it must be idempotent. Returns true if the response was a
 * mark-complete action that succeeded; failures are reported and surfaced to
 * the user with a follow-up notification, since a silent failure from a
 * button press looks like success.
 */
export async function handleReminderResponse(
  response: Notifications.NotificationResponse
): Promise<boolean> {
  if (response.actionIdentifier !== MARK_COMPLETE_ACTION_ID) return false;
  const { request } = response.notification;
  const { groupId, readingDate } = getReminderTarget(request);
  if (!groupId) {
    Sentry.captureMessage('handleReminderResponse: mark-complete action without a group id', 'error');
    return false;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not signed in');

    try {
      await markComplete(session.user.id, groupId, readingDate ?? format(new Date(), 'yyyy-MM-dd'));
    } catch (error: any) {
      // Already marked (in the app or by a duplicate delivery of this action).
      if (error?.message !== 'Already completed') throw error;
    }
    await Notifications.dismissNotificationAsync(request.identifier);
    return true;
  } catch (error) {
    Sentry.captureException(error, { tags: { context: 'reminder_mark_complete' } });
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Couldn't mark complete",
        body: "Open the app to mark the reading complete.",
        data: { type: 'reminder_action_failed' },
      },
      trigger: { channelId: ANDROID_CHANNEL_ID },
    });
    return false;
  }
}

/**
 * Request notification permissions and save the Expo push token to the DB.
 * Dormant: nothing calls this since reminders moved on-device (see
 * scheduleReadingReminders). Kept for if server-driven push is revived for
 * group-aware notifications. Silently skips if on a simulator or if the
 * user has already denied permissions.
 */
export async function registerForPushNotifications(userId: string): Promise<void> {
  if (!Device.isDevice) {
    // Push notifications only work on physical devices
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return;
  }

  await ensureAndroidChannel();

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    // Should never happen if app.json/eas.json are correct — a missing
    // projectId means push can never work, so this is a config bug, not
    // an expected skip. Surface it instead of failing silently.
    Sentry.captureMessage('registerForPushNotifications: missing EAS projectId', 'error');
    return;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

  // Validate token format before saving to DB
  if (!/^ExponentPushToken\[.+\]$/.test(tokenData.data)) {
    Sentry.captureMessage(
      `registerForPushNotifications: unexpected token format from getExpoPushTokenAsync: ${tokenData.data}`,
      'error'
    );
    return;
  }

  const { error } = await supabase
    .from('users')
    .update({ push_token: tokenData.data })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Dismiss the notification for a specific group from the tray.
 * Matches by group_id in the notification's data payload so only
 * that group's card is cleared, leaving other groups' reminders intact.
 */
export async function dismissTodayNotification(groupId: string): Promise<void> {
  const presented = await Notifications.getPresentedNotificationsAsync();
  const matching = presented.filter(
    (n) => n.request.content.data?.group_id === groupId
  );
  await Promise.all(
    matching.map((n) => Notifications.dismissNotificationAsync(n.request.identifier))
  );
}

/**
 * Returns whether the user has granted notification permissions.
 * Used by SettingsScreen to show current permission status.
 */
export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}
