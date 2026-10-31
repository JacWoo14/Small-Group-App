import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as Sentry from '@sentry/react-native';
import { handleReminderResponse } from './notifications';

export const REMINDER_ACTION_TASK = 'REMINDER-ACTION-TASK';

// Runs when a reminder's "Mark complete" button is pressed while the app is
// backgrounded or closed (Android only). The task must be defined at module
// load, from the app entry point, so it exists when the OS starts the app's
// JS runtime headlessly. In-app presses go through the listener in
// useReminderSync instead.
if (Platform.OS === 'android') {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    REMINDER_ACTION_TASK,
    async ({ data, error }) => {
      if (error || !data || !('actionIdentifier' in data)) return;
      await handleReminderResponse(data);
    }
  );

  Notifications.registerTaskAsync(REMINDER_ACTION_TASK).catch((error) => {
    Sentry.captureException(error, { tags: { context: 'reminder_task_register' } });
  });
}
