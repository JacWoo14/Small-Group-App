import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';
import { supabase } from './supabase';

const VIBRATION_PATTERN_MS: number[] = [0, 250, 250, 250];
const ANDROID_CHANNEL_ID = 'default';
const DAILY_REMINDER_ID = 'daily-reading-reminder';

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Daily Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: VIBRATION_PATTERN_MS,
  });
}

/**
 * Schedule (or reschedule) the on-device daily reading reminder at the user's
 * preferred time ("HH:MM" or "HH:MM:SS", device-local). Runs entirely on the
 * phone via the OS alarm system: no push token, FCM, or server involved, so it
 * also works on emulators. Returns false if notification permission is not
 * granted; throws if the time string is malformed.
 */
export async function scheduleDailyReminder(preferredTime: string): Promise<boolean> {
  const [hour, minute] = preferredTime.split(':').map(Number);
  if (
    !Number.isInteger(hour) || !Number.isInteger(minute) ||
    hour < 0 || hour > 23 || minute < 0 || minute > 59
  ) {
    throw new Error(`scheduleDailyReminder: invalid time "${preferredTime}"`);
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

  // Cancel first so a changed time replaces the old schedule instead of
  // adding a second reminder.
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: "Today's reading",
      body: 'Open the app to read and mark it complete.',
      data: { type: 'daily_reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
  return true;
}

/** Remove the daily reminder (e.g. on sign out). No-op if none is scheduled. */
export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
}

/**
 * Request notification permissions and save the Expo push token to the DB.
 * Dormant: nothing calls this since reminders moved on-device (see
 * scheduleDailyReminder). Kept for if server-driven push is revived for
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
