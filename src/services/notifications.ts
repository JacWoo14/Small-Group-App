import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

const VIBRATION_PATTERN_MS: number[] = [0, 250, 250, 250];

/**
 * Request notification permissions and save the Expo push token to the DB.
 * Safe to call on every login — silently skips if on a simulator or if the
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

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Daily Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: VIBRATION_PATTERN_MS,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return;

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

  // Validate token format before saving to DB
  if (!/^ExponentPushToken\[.+\]$/.test(tokenData.data)) return;

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
  if (!Device.isDevice) return 'undetermined';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}
