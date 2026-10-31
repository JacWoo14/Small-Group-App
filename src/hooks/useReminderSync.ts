import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { useAuth } from '../context/AuthContext';
import { useUserGroups } from './useGroups';
import { scheduleDailyReminders, handleReminderResponse } from '../services/notifications';

/**
 * Keeps the on-device daily reminders in step with the user's groups and
 * preferred time (one reminder per group), and handles "Mark complete"
 * presses while the app is open. Mount once inside the signed-in app.
 */
export function useReminderSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: groups } = useUserGroups();

  const time = user?.preferred_notification_time;
  // Reschedule only when ids or names change, not on every refetch.
  const groupsKey = (groups ?? [])
    .map((g) => `${g.id}:${g.name}`)
    .sort()
    .join('|');

  useEffect(() => {
    // Wait for groups to load; on error `groups` stays undefined, leaving
    // the existing schedule in place rather than wiping it.
    if (!time || !groups) return;
    scheduleDailyReminders(
      time,
      groups.map(({ id, name }) => ({ id, name }))
    ).catch((error) => {
      Sentry.captureException(error, { tags: { context: 'daily_reminder_schedule' } });
    });
    // `groups` is represented by groupsKey so refetches with identical data don't reschedule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, groupsKey]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleReminderResponse(response).then((marked) => {
        if (!marked) return;
        queryClient.invalidateQueries({ queryKey: ['readings'] });
        queryClient.invalidateQueries({ queryKey: ['group'] });
        queryClient.invalidateQueries({ queryKey: ['streak'] });
      });
    });
    return () => subscription.remove();
  }, [queryClient]);
}
