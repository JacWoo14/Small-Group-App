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
const REMINDER_ID_PREFIX = 'daily-reminder-';
// Id of the single generic reminder scheduled by the previous version; still
// cancelled so an upgraded install doesn't fire it alongside the per-group ones.
const LEGACY_REMINDER_ID = 'daily-reading-reminder';
const REMINDER_CATEGORY_ID = 'reading-reminder';

export const MARK_COMPLETE_ACTION_ID = 'mark-complete';

export type ReminderGroup = { id: string; name: string };

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

/** Cancel every reminder this app scheduled (current per-group ones and the legacy one). */
export async function cancelDailyReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const { identifier } of scheduled) {
    if (identifier === LEGACY_REMINDER_ID || identifier.startsWith(REMINDER_ID_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    }
  }
}

/**
 * Replace all on-device daily reminders with one per group, at the user's
 * preferred time ("HH:MM" or "HH:MM:SS", device-local). Each notification is
 * titled with the group's name and carries a "Mark complete" action for that
 * group. Runs entirely on the phone via the OS alarm system: no push token,
 * FCM, or server involved, so it also works on emulators. Returns false if
 * notification permission is not granted; throws if the time is malformed.
 */
export async function scheduleDailyReminders(
  preferredTime: string,
  groups: ReminderGroup[]
): Promise<boolean> {
  const [hour, minute] = preferredTime.split(':').map(Number);
  if (
    !Number.isInteger(hour) || !Number.isInteger(minute) ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59
  ) {
    throw new Error(`scheduleDailyReminders: invalid time "${preferredTime}"`);
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

  // Start clean so a changed time, renamed group, or left group never leaves
  // a stale reminder behind.
  await cancelDailyReminders();
  for (const group of groups) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${REMINDER_ID_PREFIX}${group.id}`,
      content: {
        title: group.name,
        body: "Time for today's reading.",
        categoryIdentifier: REMINDER_CATEGORY_ID,
        data: { type: 'daily_reminder', group_id: group.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: ANDROID_CHANNEL_ID,
      },
    });
  }
  return true;
}

/**
 * Which group a reminder belongs to. The in-app listener delivers the data
 * as an object, but the background task (app closed) delivers it only as a
 * JSON string (`dataString`), so `content.data` is undefined there. The
 * notification id (`daily-reminder-<groupId>`) is the last resort.
 */
function getReminderGroupId(request: Notifications.NotificationRequest): string | undefined {
  const fromData = request.content.data?.group_id;
  if (typeof fromData === 'string') return fromData;

  const dataString = (request.content as { dataString?: unknown }).dataString;
  if (typeof dataString === 'string') {
    try {
      const fromString = JSON.parse(dataString)?.group_id;
      if (typeof fromString === 'string') return fromString;
    } catch {
      // fall through to the id
    }
  }

  return request.identifier.startsWith(REMINDER_ID_PREFIX)
    ? request.identifier.slice(REMINDER_ID_PREFIX.length)
    : undefined;
}

/**
 * Handle the user pressing "Mark complete" on a reminder: record today's
 * completion for that notification's group, then clear it from the tray.
 * Runs from a background task (app closed or backgrounded) as well as from
 * the in-app listener, so it must be idempotent. Returns true if the response
 * was a mark-complete action that succeeded; failures are reported and surfaced
 * to the user with a follow-up notification, since a silent failure from a
 * button press looks like success.
 */
export async function handleReminderResponse(
  response: Notifications.NotificationResponse
): Promise<boolean> {
  if (response.actionIdentifier !== MARK_COMPLETE_ACTION_ID) return false;
  const { request } = response.notification;
  const { identifier } = request;
  const groupId = getReminderGroupId(request);
  if (!groupId) {
    Sentry.captureMessage('handleReminderResponse: mark-complete action without a group id', 'error');
    return false;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Not signed in');

    try {
      await markComplete(session.user.id, groupId, format(new Date(), 'yyyy-MM-dd'));
    } catch (error: any) {
      // Already marked (in the app or by a duplicate delivery of this action).
      if (error?.message !== 'Already completed') throw error;
    }
    await Notifications.dismissNotificationAsync(identifier);
    return true;
  } catch (error) {
    Sentry.captureException(error, { tags: { context: 'reminder_mark_complete' } });
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Couldn't mark complete",
        body: "Open the app to mark today's reading complete.",
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
 * scheduleDailyReminders). Kept for if server-driven push is revived for
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
