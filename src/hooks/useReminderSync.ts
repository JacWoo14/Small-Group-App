import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useUserGroups } from './useGroups';
import { scheduleReadingReminders, handleReminderResponse } from '../services/notifications';
import { getUpcomingReminders } from '../services/reminders';

const todayString = () => format(new Date(), 'yyyy-MM-dd');

/**
 * Keeps the on-device reading reminders in step with the user's groups, their
 * plans, and their preferred time: one reminder per group per upcoming day,
 * each showing that day's passage. Re-syncs when any of those change and when
 * the app comes back to the foreground on a new day (rolling the window
 * forward). Also handles "Mark complete" presses while the app is open. Mount
 * once inside the signed-in app.
 */
export function useReminderSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: groups } = useUserGroups();
  const [syncDay, setSyncDay] = useState(todayString);

  const userId = user?.id;
  const timezone = user?.timezone;
  const time = user?.preferred_notification_time;
  // Reschedule only when membership, names, or plans change, not on every refetch.
  const groupsKey = (groups ?? [])
    .map((g) => `${g.id}:${g.name}:${g.reading_plan_id}`)
    .sort()
    .join('|');

  useEffect(() => {
    // Wait for groups to load; on error `groups` stays undefined, leaving the
    // existing schedule in place rather than wiping it.
    if (!userId || !time || !groups) return;

    let cancelled = false;
    (async () => {
      const reminders = await getUpcomingReminders(userId, timezone ?? 'UTC');
      if (cancelled) return;
      await scheduleReadingReminders(time, reminders);
    })().catch((error) => {
      Sentry.captureException(error, { tags: { context: 'daily_reminder_schedule' } });
    });

    return () => {
      cancelled = true;
    };
    // `groups` is represented by groupsKey so refetches with identical data don't reschedule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, timezone, time, groupsKey, syncDay]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setSyncDay(todayString());
    });
    return () => subscription.remove();
  }, []);

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
