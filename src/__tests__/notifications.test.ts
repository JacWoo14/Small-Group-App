/**
 * Unit tests for src/services/notifications.ts
 *
 * All exported functions are tested here:
 *   - scheduleReadingReminders
 *   - cancelReadingReminders / cancelReadingReminder
 *   - handleReminderResponse (the "Mark complete" notification action)
 *   - registerForPushNotifications (dormant; kept for a possible server-push revival)
 *   - dismissTodayNotification
 *   - getNotificationPermissionStatus
 *
 * expo-notifications, expo-device, expo-constants, and supabase are fully
 * mocked so no native modules or network calls are required.
 */

// ─── Module mocks (must be declared before any imports) ─────────────────────

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  getPresentedNotificationsAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
}));

jest.mock('expo-device', () => ({
  isDevice: true, // default: physical device; overridden per-test where needed
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        eas: { projectId: 'test-project-id' },
      },
    },
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' }, // default: iOS; overridden per-test for android branch
}));

const mockCaptureMessage = jest.fn();
const mockCaptureException = jest.fn();
jest.mock('@sentry/react-native', () => ({
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

// Supabase client mock — update().eq() returns no error by default
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockGetSession = jest.fn();
jest.mock('../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: mockUpdate,
    })),
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

const mockMarkComplete = jest.fn();
jest.mock('../services/completions', () => ({
  markComplete: (...args: unknown[]) => mockMarkComplete(...args),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { format } from 'date-fns';
import {
  scheduleReadingReminders,
  cancelReadingReminders,
  cancelReadingReminder,
  handleReminderResponse,
  MARK_COMPLETE_ACTION_ID,
  registerForPushNotifications,
  dismissTodayNotification,
  getNotificationPermissionStatus,
} from '../services/notifications';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Cast to jest.MockedFunction for clean TypeScript access to mock methods */
const mockGetPermissions = Notifications.getPermissionsAsync as jest.MockedFunction<typeof Notifications.getPermissionsAsync>;
const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.MockedFunction<typeof Notifications.requestPermissionsAsync>;
const mockSetChannel = Notifications.setNotificationChannelAsync as jest.MockedFunction<typeof Notifications.setNotificationChannelAsync>;
const mockGetToken = Notifications.getExpoPushTokenAsync as jest.MockedFunction<typeof Notifications.getExpoPushTokenAsync>;
const mockGetPresentedNotifications = Notifications.getPresentedNotificationsAsync as jest.MockedFunction<typeof Notifications.getPresentedNotificationsAsync>;
const mockDismissNotification = Notifications.dismissNotificationAsync as jest.MockedFunction<typeof Notifications.dismissNotificationAsync>;
const mockScheduleNotification = Notifications.scheduleNotificationAsync as jest.MockedFunction<typeof Notifications.scheduleNotificationAsync>;
const mockCancelScheduled = Notifications.cancelScheduledNotificationAsync as jest.MockedFunction<typeof Notifications.cancelScheduledNotificationAsync>;
const mockGetAllScheduled = Notifications.getAllScheduledNotificationsAsync as jest.MockedFunction<typeof Notifications.getAllScheduledNotificationsAsync>;
const mockSetCategory = Notifications.setNotificationCategoryAsync as jest.MockedFunction<typeof Notifications.setNotificationCategoryAsync>;

// ─── Shared beforeEach ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Default: permissions already granted, no prompt needed
  mockGetPermissions.mockResolvedValue({ status: 'granted' } as any);
  mockRequestPermissions.mockResolvedValue({ status: 'granted' } as any);
  mockSetChannel.mockResolvedValue(null as any);
  mockGetToken.mockResolvedValue({ data: 'ExponentPushToken[test]', type: 'expo' } as any);
  mockGetPresentedNotifications.mockResolvedValue([]);
  mockDismissNotification.mockResolvedValue(undefined);
  mockScheduleNotification.mockResolvedValue('daily-reading-reminder');
  mockCancelScheduled.mockResolvedValue(undefined);
  mockGetAllScheduled.mockResolvedValue([]);
  mockSetCategory.mockResolvedValue({} as any);
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
  mockMarkComplete.mockResolvedValue({});

  // Supabase update chain: update() → eq() → { error: null }
  mockEq.mockResolvedValue({ error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });

  // Reset module-level mutable properties
  (Device as any).isDevice = true;
  (Platform as any).OS = 'ios';
});

// ─── scheduleReadingReminders ────────────────────────────────────────────────

// Far-future dates so the "already passed today" skip never applies by accident.
const D1 = '2099-03-05';
const D2 = '2099-03-06';
const REMINDERS = [
  { groupId: 'group-a', groupName: "Guy's Life Group", date: D1, passages: ['Jeremiah 48'] },
  { groupId: 'group-a', groupName: "Guy's Life Group", date: D2, passages: ['Jeremiah 49', 'Psalm 23'] },
  { groupId: 'group-b', groupName: 'Morning Psalms', date: D1, passages: ['Psalm 1-4'] },
];

describe('scheduleReadingReminders', () => {
  it('schedules one dated notification per group per day at the preferred time', async () => {
    const result = await scheduleReadingReminders('19:45:00', REMINDERS);

    expect(result).toBe(true);
    expect(mockScheduleNotification).toHaveBeenCalledTimes(3);
    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'reading-reminder-group-a-2099-03-05',
        trigger: expect.objectContaining({ type: 'date', date: new Date(2099, 2, 5, 19, 45, 0, 0) }),
      })
    );
    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'reading-reminder-group-a-2099-03-06' })
    );
    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'reading-reminder-group-b-2099-03-05' })
    );
  });

  it("titles each reminder with the group's name and shows that day's passages as the text", async () => {
    await scheduleReadingReminders('07:00:00', REMINDERS);

    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: "Guy's Life Group", body: 'Jeremiah 48' }),
      })
    );
    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: "Guy's Life Group", body: 'Jeremiah 49, Psalm 23' }),
      })
    );
  });

  it('tags each reminder with its group id and reading date for the Mark complete action', async () => {
    await scheduleReadingReminders('07:00:00', REMINDERS);

    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          categoryIdentifier: 'reading-reminder',
          data: { type: 'daily_reminder', group_id: 'group-b', reading_date: D1 },
        }),
      })
    );
  });

  it('registers the "Mark complete" action so it does not open the app', async () => {
    await scheduleReadingReminders('07:00:00', REMINDERS);

    expect(mockSetCategory).toHaveBeenCalledWith('reading-reminder', [
      {
        identifier: MARK_COMPLETE_ACTION_ID,
        buttonTitle: 'Mark complete',
        options: { opensAppToForeground: false },
      },
    ]);
  });

  it('accepts an "HH:MM" time without seconds', async () => {
    await scheduleReadingReminders('07:05', REMINDERS);

    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ date: new Date(2099, 2, 5, 7, 5, 0, 0) }),
      })
    );
  });

  it('skips reminders whose time has already passed', async () => {
    await scheduleReadingReminders('07:00:00', [
      { groupId: 'group-a', groupName: 'A', date: '2000-01-01', passages: ['Genesis 1'] },
      ...REMINDERS,
    ]);

    expect(mockScheduleNotification).toHaveBeenCalledTimes(3);
    expect(mockScheduleNotification).not.toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'reading-reminder-group-a-2000-01-01' })
    );
  });

  it('cancels all earlier reminders (current, previous, legacy) before scheduling, leaving other notifications alone', async () => {
    const order: string[] = [];
    mockGetAllScheduled.mockResolvedValue([
      { identifier: 'reading-reminder-old-group-2099-01-01' },
      { identifier: 'daily-reminder-old-group' },
      { identifier: 'daily-reading-reminder' },
      { identifier: 'someone-elses-notification' },
    ] as any);
    mockCancelScheduled.mockImplementation(async (id) => { order.push(`cancel:${id}`); });
    mockScheduleNotification.mockImplementation(async () => { order.push('schedule'); return 'id'; });

    await scheduleReadingReminders('08:00:00', [REMINDERS[0]]);

    expect(order).toEqual([
      'cancel:reading-reminder-old-group-2099-01-01',
      'cancel:daily-reminder-old-group',
      'cancel:daily-reading-reminder',
      'schedule',
    ]);
    expect(mockCancelScheduled).not.toHaveBeenCalledWith('someone-elses-notification');
  });

  it('schedules nothing but still clears old reminders when there are no readings', async () => {
    mockGetAllScheduled.mockResolvedValue([{ identifier: 'reading-reminder-gone-2099-01-01' }] as any);

    const result = await scheduleReadingReminders('07:00:00', []);

    expect(result).toBe(true);
    expect(mockCancelScheduled).toHaveBeenCalledWith('reading-reminder-gone-2099-01-01');
    expect(mockScheduleNotification).not.toHaveBeenCalled();
  });

  it('works on a simulator/emulator (no Device.isDevice gate)', async () => {
    (Device as any).isDevice = false;

    const result = await scheduleReadingReminders('07:00:00', REMINDERS);

    expect(result).toBe(true);
    expect(mockScheduleNotification).toHaveBeenCalled();
  });

  it('requests permission when undetermined and schedules on grant', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'undetermined' } as any);
    mockRequestPermissions.mockResolvedValue({ status: 'granted' } as any);

    const result = await scheduleReadingReminders('07:00:00', REMINDERS);

    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
    expect(mockScheduleNotification).toHaveBeenCalled();
  });

  it('does not touch existing reminders and returns false when permission is denied', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied' } as any);
    mockRequestPermissions.mockResolvedValue({ status: 'denied' } as any);

    const result = await scheduleReadingReminders('07:00:00', REMINDERS);

    expect(result).toBe(false);
    expect(mockScheduleNotification).not.toHaveBeenCalled();
    expect(mockCancelScheduled).not.toHaveBeenCalled();
  });

  it('sets the Android channel and targets it from the trigger', async () => {
    (Platform as any).OS = 'android';

    await scheduleReadingReminders('07:00:00', REMINDERS);

    expect(mockSetChannel).toHaveBeenCalledWith('default', expect.objectContaining({ name: 'Daily Reminders' }));
    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: expect.objectContaining({ channelId: 'default' }) })
    );
  });

  it('does not set an Android channel on iOS', async () => {
    (Platform as any).OS = 'ios';

    await scheduleReadingReminders('07:00:00', REMINDERS);

    expect(mockSetChannel).not.toHaveBeenCalled();
  });

  it.each(['', 'abc', '25:00:00', '07:60:00', '-1:00:00', '07'])(
    'throws on a malformed or out-of-range time (%p) without scheduling',
    async (bad) => {
      await expect(scheduleReadingReminders(bad, REMINDERS)).rejects.toThrow('invalid time');
      expect(mockScheduleNotification).not.toHaveBeenCalled();
    }
  );

  it('propagates errors from scheduleNotificationAsync', async () => {
    mockScheduleNotification.mockRejectedValue(new Error('alarm service unavailable'));

    await expect(scheduleReadingReminders('07:00:00', REMINDERS)).rejects.toThrow('alarm service unavailable');
  });
});

// ─── cancelReadingReminders / cancelReadingReminder ──────────────────────────

describe('cancelReadingReminders', () => {
  it("cancels this app's reminders (current, previous, legacy) and leaves other notifications alone", async () => {
    mockGetAllScheduled.mockResolvedValue([
      { identifier: 'reading-reminder-group-a-2099-03-05' },
      { identifier: 'daily-reminder-group-b' },
      { identifier: 'daily-reading-reminder' },
      { identifier: 'unrelated' },
    ] as any);

    await cancelReadingReminders();

    expect(mockCancelScheduled).toHaveBeenCalledTimes(3);
    expect(mockCancelScheduled).toHaveBeenCalledWith('reading-reminder-group-a-2099-03-05');
    expect(mockCancelScheduled).toHaveBeenCalledWith('daily-reminder-group-b');
    expect(mockCancelScheduled).toHaveBeenCalledWith('daily-reading-reminder');
  });

  it('is a no-op when nothing is scheduled', async () => {
    mockGetAllScheduled.mockResolvedValue([]);

    await expect(cancelReadingReminders()).resolves.toBeUndefined();
    expect(mockCancelScheduled).not.toHaveBeenCalled();
  });
});

describe('cancelReadingReminder', () => {
  it("cancels one group's reminder for one date by its id", async () => {
    await cancelReadingReminder('group-a', '2026-10-30');

    expect(mockCancelScheduled).toHaveBeenCalledWith('reading-reminder-group-a-2026-10-30');
  });
});

// ─── handleReminderResponse ──────────────────────────────────────────────────

function makeResponse(
  overrides: {
    actionIdentifier?: string;
    data?: Record<string, unknown>;
    content?: Record<string, unknown>;
    identifier?: string;
  } = {}
) {
  return {
    actionIdentifier: overrides.actionIdentifier ?? MARK_COMPLETE_ACTION_ID,
    notification: {
      request: {
        identifier: overrides.identifier ?? 'notif-123',
        content: overrides.content ?? {
          data: overrides.data ?? { type: 'daily_reminder', group_id: 'group-a', reading_date: '2026-10-30' },
        },
      },
    },
  } as any;
}

const TODAY = () => format(new Date(), 'yyyy-MM-dd');

describe('handleReminderResponse', () => {
  it("marks the reminder's own reading date complete for its group and dismisses it", async () => {
    const result = await handleReminderResponse(makeResponse());

    expect(result).toBe(true);
    expect(mockMarkComplete).toHaveBeenCalledWith('user-1', 'group-a', '2026-10-30');
    expect(mockDismissNotification).toHaveBeenCalledWith('notif-123');
  });

  it("uses the reminder's date, not today's, when pressed the next day", async () => {
    await handleReminderResponse(
      makeResponse({ data: { group_id: 'group-a', reading_date: '2020-01-01' } })
    );

    expect(mockMarkComplete).toHaveBeenCalledWith('user-1', 'group-a', '2020-01-01');
  });

  it('falls back to today for reminders that carry no reading date', async () => {
    await handleReminderResponse(makeResponse({ data: { type: 'daily_reminder', group_id: 'group-a' } }));

    expect(mockMarkComplete).toHaveBeenCalledWith('user-1', 'group-a', TODAY());
  });

  it('treats "Already completed" as success and still dismisses the notification', async () => {
    mockMarkComplete.mockRejectedValue(new Error('Already completed'));

    const result = await handleReminderResponse(makeResponse());

    expect(result).toBe(true);
    expect(mockDismissNotification).toHaveBeenCalledWith('notif-123');
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('ignores a plain tap (default action) without touching the database', async () => {
    const result = await handleReminderResponse(
      makeResponse({ actionIdentifier: 'expo.modules.notifications.actions.DEFAULT' })
    );

    expect(result).toBe(false);
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockMarkComplete).not.toHaveBeenCalled();
  });

  it('reads group and date from dataString when the app is closed (background task payload has no data object)', async () => {
    // Regression: with the app closed, the task delivers content.dataString
    // (a JSON string) and no content.data, so the button silently did nothing.
    const result = await handleReminderResponse(
      makeResponse({
        content: {
          dataString: JSON.stringify({ type: 'daily_reminder', group_id: 'group-from-string', reading_date: '2026-10-29' }),
        },
      })
    );

    expect(result).toBe(true);
    expect(mockMarkComplete).toHaveBeenCalledWith('user-1', 'group-from-string', '2026-10-29');
  });

  it('falls back to the notification id (reading-reminder-<groupId>-<date>) when no data is available', async () => {
    const result = await handleReminderResponse(
      makeResponse({ content: {}, identifier: 'reading-reminder-3f9a-bb12-2026-10-28' })
    );

    expect(result).toBe(true);
    expect(mockMarkComplete).toHaveBeenCalledWith('user-1', '3f9a-bb12', '2026-10-28');
  });

  it('still handles reminders scheduled by the previous version (daily-reminder-<groupId>) using today', async () => {
    const result = await handleReminderResponse(
      makeResponse({ content: {}, identifier: 'daily-reminder-group-old' })
    );

    expect(result).toBe(true);
    expect(mockMarkComplete).toHaveBeenCalledWith('user-1', 'group-old', TODAY());
  });

  it('ignores an unparseable dataString and resolves the target from the id', async () => {
    const result = await handleReminderResponse(
      makeResponse({
        content: { dataString: '{not json' },
        identifier: 'reading-reminder-group-a-2026-10-30',
      })
    );

    expect(result).toBe(true);
    expect(mockMarkComplete).toHaveBeenCalledWith('user-1', 'group-a', '2026-10-30');
  });

  it('reports a mark-complete action whose group cannot be determined, instead of ignoring it silently', async () => {
    const result = await handleReminderResponse(makeResponse({ data: { type: 'daily_reminder' } }));

    expect(result).toBe(false);
    expect(mockMarkComplete).not.toHaveBeenCalled();
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('without a group id'),
      'error'
    );
  });

  it('reports the failure and tells the user when marking complete fails', async () => {
    const failure = new Error('network request failed');
    mockMarkComplete.mockRejectedValue(failure);

    const result = await handleReminderResponse(makeResponse());

    expect(result).toBe(false);
    expect(mockCaptureException).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ tags: expect.objectContaining({ context: 'reminder_mark_complete' }) })
    );
    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: "Couldn't mark complete" }),
      })
    );
    expect(mockDismissNotification).not.toHaveBeenCalled();
  });

  it('fails visibly (not silently) when there is no signed-in session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await handleReminderResponse(makeResponse());

    expect(result).toBe(false);
    expect(mockMarkComplete).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalled();
    expect(mockScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: "Couldn't mark complete" }),
      })
    );
  });
});


// ─── registerForPushNotifications ────────────────────────────────────────────

describe('registerForPushNotifications', () => {
  it('returns immediately on simulator (Device.isDevice === false)', async () => {
    (Device as any).isDevice = false;

    await registerForPushNotifications('user-1');

    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('skips permission request when already granted and saves token', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' } as any);

    await registerForPushNotifications('user-1');

    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockGetToken).toHaveBeenCalledWith({ projectId: 'test-project-id' });
    expect(mockUpdate).toHaveBeenCalledWith({ push_token: 'ExponentPushToken[test]' });
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('requests permission when status is "undetermined" and saves token on grant', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'undetermined' } as any);
    mockRequestPermissions.mockResolvedValue({ status: 'granted' } as any);

    await registerForPushNotifications('user-2');

    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(mockGetToken).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({ push_token: 'ExponentPushToken[test]' });
  });

  it('returns early without saving token when permission denied after request', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'undetermined' } as any);
    mockRequestPermissions.mockResolvedValue({ status: 'denied' } as any);

    await registerForPushNotifications('user-3');

    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns early without saving token when initial status is denied', async () => {
    // Both getPermissions (denied) and requestPermissions (denied) are pre-set
    mockGetPermissions.mockResolvedValue({ status: 'denied' } as any);
    mockRequestPermissions.mockResolvedValue({ status: 'denied' } as any);

    await registerForPushNotifications('user-4');

    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('sets Android notification channel when Platform.OS === "android"', async () => {
    (Platform as any).OS = 'android';
    mockGetPermissions.mockResolvedValue({ status: 'granted' } as any);

    await registerForPushNotifications('user-5');

    expect(mockSetChannel).toHaveBeenCalledWith('default', expect.objectContaining({
      name: 'Daily Reminders',
      vibrationPattern: [0, 250, 250, 250],
    }));
    expect(mockGetToken).toHaveBeenCalled();
  });

  it('does NOT set Android channel on iOS', async () => {
    (Platform as any).OS = 'ios';
    mockGetPermissions.mockResolvedValue({ status: 'granted' } as any);

    await registerForPushNotifications('user-6');

    expect(mockSetChannel).not.toHaveBeenCalled();
  });

  it('returns early without saving token when projectId is missing, and reports it', async () => {
    // Override only the expoConfig shape on the default-exported Constants object
    const original = (Constants as any).expoConfig;
    (Constants as any).expoConfig = { extra: { eas: {} } };
    mockGetPermissions.mockResolvedValue({ status: 'granted' } as any);

    await registerForPushNotifications('user-7');

    expect(mockGetToken).not.toHaveBeenCalled();
    // Regression: this used to fail completely silently, making a broken
    // EAS project config indistinguishable from "user denied permission".
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('missing EAS projectId'),
      'error'
    );

    // Restore
    (Constants as any).expoConfig = original;
  });

  it('throws when Supabase update returns an error', async () => {
    const dbError = new Error('DB write failed');
    mockEq.mockResolvedValue({ error: dbError });

    await expect(registerForPushNotifications('user-8')).rejects.toThrow('DB write failed');
  });

  it('propagates error when getExpoPushTokenAsync throws', async () => {
    mockGetToken.mockRejectedValue(new Error('token fetch failed'));

    await expect(registerForPushNotifications('user-9')).rejects.toThrow('token fetch failed');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns early without saving token when expoConfig is null', async () => {
    const original = (Constants as any).expoConfig;
    (Constants as any).expoConfig = null;

    await registerForPushNotifications('user-10');

    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();

    (Constants as any).expoConfig = original;
  });

  it('saves token scoped to the exact userId passed in', async () => {
    const userId = 'specific-user-abc123';
    await registerForPushNotifications(userId);

    expect(mockEq).toHaveBeenCalledWith('id', userId);
  });

  it('skips saving when token format is invalid, and reports it', async () => {
    mockGetToken.mockResolvedValue({ data: 'invalid-token-format', type: 'expo' } as any);

    await registerForPushNotifications('user-11');

    expect(mockUpdate).not.toHaveBeenCalled();
    // Regression: an unexpected token shape from the Expo SDK used to be
    // indistinguishable from "device not registered" or "no permission".
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('unexpected token format'),
      'error'
    );
  });
});

// ─── dismissTodayNotification ─────────────────────────────────────────────────

describe('dismissTodayNotification', () => {
  it('dismisses only the notification matching the given groupId', async () => {
    mockGetPresentedNotifications.mockResolvedValue([
      { request: { identifier: 'notif-1', content: { data: { group_id: 'group-abc' } } } },
      { request: { identifier: 'notif-2', content: { data: { group_id: 'group-xyz' } } } },
    ] as any);

    await dismissTodayNotification('group-abc');

    expect(mockDismissNotification).toHaveBeenCalledTimes(1);
    expect(mockDismissNotification).toHaveBeenCalledWith('notif-1');
  });

  it('dismisses multiple notifications when more than one matches the groupId', async () => {
    mockGetPresentedNotifications.mockResolvedValue([
      { request: { identifier: 'notif-1', content: { data: { group_id: 'group-abc' } } } },
      { request: { identifier: 'notif-2', content: { data: { group_id: 'group-abc' } } } },
    ] as any);

    await dismissTodayNotification('group-abc');

    expect(mockDismissNotification).toHaveBeenCalledTimes(2);
  });

  it('does not call dismissNotificationAsync when no notification matches', async () => {
    mockGetPresentedNotifications.mockResolvedValue([
      { request: { identifier: 'notif-1', content: { data: { group_id: 'group-xyz' } } } },
    ] as any);

    await dismissTodayNotification('group-abc');

    expect(mockDismissNotification).not.toHaveBeenCalled();
  });

  it('resolves when no notifications are present', async () => {
    mockGetPresentedNotifications.mockResolvedValue([]);

    await expect(dismissTodayNotification('group-abc')).resolves.toBeUndefined();
  });

  it('propagates error when getPresentedNotificationsAsync throws', async () => {
    mockGetPresentedNotifications.mockRejectedValue(new Error('fetch failed'));

    await expect(dismissTodayNotification('group-abc')).rejects.toThrow('fetch failed');
  });
});

// ─── getNotificationPermissionStatus ─────────────────────────────────────────

describe('getNotificationPermissionStatus', () => {
  it('reads the real permission status on a simulator/emulator too', async () => {
    (Device as any).isDevice = false;
    mockGetPermissions.mockResolvedValue({ status: 'granted' } as any);

    const result = await getNotificationPermissionStatus();

    expect(result).toBe('granted');
    expect(mockGetPermissions).toHaveBeenCalledTimes(1);
  });

  it('returns "granted" when permission is granted on a real device', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' } as any);

    const result = await getNotificationPermissionStatus();

    expect(result).toBe('granted');
    expect(mockGetPermissions).toHaveBeenCalledTimes(1);
  });

  it('returns "denied" when permission is denied on a real device', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied' } as any);

    const result = await getNotificationPermissionStatus();

    expect(result).toBe('denied');
  });

  it('returns "undetermined" when permission is undetermined on a real device', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'undetermined' } as any);

    const result = await getNotificationPermissionStatus();

    expect(result).toBe('undetermined');
  });
});
