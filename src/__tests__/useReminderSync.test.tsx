/**
 * Unit tests for src/hooks/useReminderSync.ts:
 *   - keeps the per-day reading reminders in step with the user's groups,
 *     plans, and preferred time (and only reschedules when those change)
 *   - rolls the window forward when the app returns to the foreground on a new day
 *   - handles "Mark complete" presses while the app is open
 *
 * Auth, the groups query, the notifications/reminders services, and
 * expo-notifications are mocked so nothing touches the network or native modules.
 */

import React from 'react';
import { AppState } from 'react-native';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockUseAuth = jest.fn();
jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUseUserGroups = jest.fn();
jest.mock('../hooks/useGroups', () => ({
  useUserGroups: () => mockUseUserGroups(),
}));

const mockScheduleReadingReminders = jest.fn();
const mockHandleReminderResponse = jest.fn();
jest.mock('../services/notifications', () => ({
  scheduleReadingReminders: (...args: any[]) => mockScheduleReadingReminders(...args),
  handleReminderResponse: (...args: any[]) => mockHandleReminderResponse(...args),
}));

const mockGetUpcomingReminders = jest.fn();
jest.mock('../services/reminders', () => ({
  getUpcomingReminders: (...args: any[]) => mockGetUpcomingReminders(...args),
}));

let responseListener: ((response: any) => void) | null = null;
const mockRemoveResponseSubscription = jest.fn();
jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: (cb: (response: any) => void) => {
    responseListener = cb;
    return { remove: mockRemoveResponseSubscription };
  },
}));

const mockCaptureException = jest.fn();
jest.mock('@sentry/react-native', () => ({
  captureException: (...args: any[]) => mockCaptureException(...args),
}));

import { useReminderSync } from '../hooks/useReminderSync';

const USER = { id: 'user-1', timezone: 'America/Chicago', preferred_notification_time: '19:45:00' };
const GROUP_A = { id: 'group-a', name: "Guy's Life Group", reading_plan_id: 'plan-1', extra: 'ignored' };
const GROUP_B = { id: 'group-b', name: 'Morning Psalms', reading_plan_id: 'plan-2' };
const REMINDERS = [
  { groupId: 'group-a', groupName: "Guy's Life Group", date: '2099-03-05', passages: ['Jeremiah 48'] },
];

let queryClient: QueryClient;
let appStateListener: ((state: string) => void) | null = null;
const mockRemoveAppState = jest.fn();

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  responseListener = null;
  appStateListener = null;
  queryClient = new QueryClient();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, cb: (state: string) => void) => {
    appStateListener = cb;
    return { remove: mockRemoveAppState };
  }) as any);
  mockUseAuth.mockReturnValue({ user: USER });
  mockUseUserGroups.mockReturnValue({ data: [GROUP_A] });
  mockGetUpcomingReminders.mockResolvedValue(REMINDERS);
  mockScheduleReadingReminders.mockResolvedValue(true);
  mockHandleReminderResponse.mockResolvedValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useReminderSync scheduling', () => {
  it("fetches the upcoming readings and schedules them at the user's preferred time", async () => {
    renderHook(() => useReminderSync(), { wrapper });

    await waitFor(() => expect(mockScheduleReadingReminders).toHaveBeenCalledTimes(1));
    expect(mockGetUpcomingReminders).toHaveBeenCalledWith('user-1', 'America/Chicago');
    expect(mockScheduleReadingReminders).toHaveBeenCalledWith('19:45:00', REMINDERS);
  });

  it('waits while groups are still loading (or failed) instead of wiping reminders', () => {
    mockUseUserGroups.mockReturnValue({ data: undefined });

    renderHook(() => useReminderSync(), { wrapper });

    expect(mockGetUpcomingReminders).not.toHaveBeenCalled();
    expect(mockScheduleReadingReminders).not.toHaveBeenCalled();
  });

  it('does nothing when there is no signed-in user', () => {
    mockUseAuth.mockReturnValue({ user: null });

    renderHook(() => useReminderSync(), { wrapper });

    expect(mockGetUpcomingReminders).not.toHaveBeenCalled();
    expect(mockScheduleReadingReminders).not.toHaveBeenCalled();
  });

  it('clears reminders (schedules an empty set) when the user has no groups', async () => {
    mockUseUserGroups.mockReturnValue({ data: [] });
    mockGetUpcomingReminders.mockResolvedValue([]);

    renderHook(() => useReminderSync(), { wrapper });

    await waitFor(() => expect(mockScheduleReadingReminders).toHaveBeenCalledWith('19:45:00', []));
  });

  it('does not reschedule when groups refetch with identical data', async () => {
    const { rerender } = renderHook(() => useReminderSync(), { wrapper });
    await waitFor(() => expect(mockScheduleReadingReminders).toHaveBeenCalledTimes(1));

    // New array and object identities, same ids, names, and plans.
    mockUseUserGroups.mockReturnValue({ data: [{ ...GROUP_A }] });
    rerender({});

    expect(mockGetUpcomingReminders).toHaveBeenCalledTimes(1);
    expect(mockScheduleReadingReminders).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a group is added', () => ({ data: [GROUP_A, GROUP_B] })],
    ['a group is renamed', () => ({ data: [{ ...GROUP_A, name: 'Renamed' }] })],
    ['a group switches reading plan', () => ({ data: [{ ...GROUP_A, reading_plan_id: 'plan-9' }] })],
  ])('reschedules when %s', async (_label, nextGroups) => {
    const { rerender } = renderHook(() => useReminderSync(), { wrapper });
    await waitFor(() => expect(mockScheduleReadingReminders).toHaveBeenCalledTimes(1));

    mockUseUserGroups.mockReturnValue(nextGroups());
    rerender({});

    await waitFor(() => expect(mockScheduleReadingReminders).toHaveBeenCalledTimes(2));
  });

  it('reschedules when the preferred time changes', async () => {
    const { rerender } = renderHook(() => useReminderSync(), { wrapper });
    await waitFor(() => expect(mockScheduleReadingReminders).toHaveBeenCalledTimes(1));

    mockUseAuth.mockReturnValue({ user: { ...USER, preferred_notification_time: '07:30:00' } });
    rerender({});

    await waitFor(() => expect(mockScheduleReadingReminders).toHaveBeenCalledTimes(2));
    expect(mockScheduleReadingReminders).toHaveBeenLastCalledWith('07:30:00', REMINDERS);
  });

  it('keeps the existing schedule and reports to Sentry when the readings cannot be fetched', async () => {
    const failure = new Error('network request failed');
    mockGetUpcomingReminders.mockRejectedValue(failure);

    renderHook(() => useReminderSync(), { wrapper });

    await waitFor(() =>
      expect(mockCaptureException).toHaveBeenCalledWith(
        failure,
        expect.objectContaining({ tags: expect.objectContaining({ context: 'daily_reminder_schedule' }) })
      )
    );
    expect(mockScheduleReadingReminders).not.toHaveBeenCalled();
  });

  it('reports scheduling failures to Sentry instead of swallowing them', async () => {
    const failure = new Error('alarm service unavailable');
    mockScheduleReadingReminders.mockRejectedValue(failure);

    renderHook(() => useReminderSync(), { wrapper });

    await waitFor(() =>
      expect(mockCaptureException).toHaveBeenCalledWith(
        failure,
        expect.objectContaining({ tags: expect.objectContaining({ context: 'daily_reminder_schedule' }) })
      )
    );
  });
});

describe('useReminderSync rolling the window forward', () => {
  // Only fake Date, so promises and waitFor keep working normally.
  const FAKE_ONLY_DATE = [
    'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame',
    'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate',
    'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout',
  ] as const;

  afterEach(() => {
    jest.useRealTimers();
  });

  it('re-syncs when the app returns to the foreground on a new day, but not on the same day', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 30, 12, 0), doNotFake: [...FAKE_ONLY_DATE] });
    renderHook(() => useReminderSync(), { wrapper });
    await waitFor(() => expect(mockScheduleReadingReminders).toHaveBeenCalledTimes(1));

    await act(async () => {
      appStateListener!('active');
    });
    expect(mockGetUpcomingReminders).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date(2026, 9, 31, 8, 0));
    await act(async () => {
      appStateListener!('active');
    });

    await waitFor(() => expect(mockGetUpcomingReminders).toHaveBeenCalledTimes(2));
    expect(mockScheduleReadingReminders).toHaveBeenCalledTimes(2);
  });

  it('ignores the app going to the background', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 30, 12, 0), doNotFake: [...FAKE_ONLY_DATE] });
    renderHook(() => useReminderSync(), { wrapper });
    await waitFor(() => expect(mockScheduleReadingReminders).toHaveBeenCalledTimes(1));

    jest.setSystemTime(new Date(2026, 9, 31, 8, 0));
    await act(async () => {
      appStateListener!('background');
    });

    expect(mockGetUpcomingReminders).toHaveBeenCalledTimes(1);
  });
});

describe('useReminderSync in-app "Mark complete" handling', () => {
  it('passes notification responses to the handler and refreshes readings when one succeeds', async () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    mockHandleReminderResponse.mockResolvedValue(true);
    renderHook(() => useReminderSync(), { wrapper });

    const response = { actionIdentifier: 'mark-complete' };
    await act(async () => {
      responseListener!(response);
    });

    expect(mockHandleReminderResponse).toHaveBeenCalledWith(response);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['readings'] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['group'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['streak'] });
  });

  it('does not refresh anything for responses that were not a successful mark-complete', async () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    mockHandleReminderResponse.mockResolvedValue(false);
    renderHook(() => useReminderSync(), { wrapper });

    await act(async () => {
      responseListener!({ actionIdentifier: 'expo.modules.notifications.actions.DEFAULT' });
    });

    expect(mockHandleReminderResponse).toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('removes both listeners on unmount', () => {
    const { unmount } = renderHook(() => useReminderSync(), { wrapper });

    unmount();

    expect(mockRemoveResponseSubscription).toHaveBeenCalledTimes(1);
    expect(mockRemoveAppState).toHaveBeenCalledTimes(1);
  });
});
