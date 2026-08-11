/**
 * Unit tests for src/services/notifications.ts
 *
 * All three exported functions are tested here:
 *   - registerForPushNotifications
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
jest.mock('@sentry/react-native', () => ({
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));

// Supabase client mock — update().eq() returns no error by default
const mockUpdate = jest.fn();
const mockEq = jest.fn();
jest.mock('../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: mockUpdate,
    })),
  },
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
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

  // Supabase update chain: update() → eq() → { error: null }
  mockEq.mockResolvedValue({ error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });

  // Reset module-level mutable properties
  (Device as any).isDevice = true;
  (Platform as any).OS = 'ios';
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
  it('returns "undetermined" on simulator without calling getPermissionsAsync', async () => {
    (Device as any).isDevice = false;

    const result = await getNotificationPermissionStatus();

    expect(result).toBe('undetermined');
    expect(mockGetPermissions).not.toHaveBeenCalled();
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
