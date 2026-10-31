/**
 * Unit tests for src/hooks/useReminderSync.ts:
 *   - keeps the per-group daily reminders in step with the user's groups and
 *     preferred time (and only reschedules when those actually change)
 *   - handles "Mark complete" presses while the app is open
 *
 * Auth, the groups query, the notifications service, and expo-notifications
 * are mocked so nothing touches the network or native modules.
 */

import React from 'react';
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

const mockScheduleDailyReminders = jest.fn();
const mockHandleReminderResponse = jest.fn();
jest.mock('../services/notifications', () => ({
  scheduleDailyReminders: (...args: any[]) => mockScheduleDailyReminders(...args),
  handleReminderResponse: (...args: any[]) => mockHandleReminderResponse(...args),
}));

let responseListener: ((response: any) => void) | null = null;
const mockRemoveSubscription = jest.fn();
jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: (cb: (response: any) => void) => {
    responseListener = cb;
    return { remove: mockRemoveSubscription };
  },
}));

const mockCaptureException = jest.fn();
jest.mock('@sentry/react-native', () => ({
  captureException: (...args: any[]) => mockCaptureException(...args),
}));

import { useReminderSync } from '../hooks/useReminderSync';

const USER = { id: 'user-1', preferred_notification_time: '19:45:00' };
const GROUP_A = { id: 'group-a', name: "Guy's Life Group", extra: 'ignored' };
const GROUP_B = { id: 'group-b', name: 'Morning Psalms' };

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  responseListener = null;
  queryClient = new QueryClient();
  mockUseAuth.mockReturnValue({ user: USER });
  mockUseUserGroups.mockReturnValue({ data: [GROUP_A] });
  mockScheduleDailyReminders.mockResolvedValue(true);
  mockHandleReminderResponse.mockResolvedValue(false);
});

describe('useReminderSync scheduling', () => {
  it('schedules a reminder per group at the preferred time once groups load', async () => {
    mockUseUserGroups.mockReturnValue({ data: [GROUP_A, GROUP_B] });

    renderHook(() => useReminderSync(), { wrapper });

    await waitFor(() => expect(mockScheduleDailyReminders).toHaveBeenCalledTimes(1));
    expect(mockScheduleDailyReminders).toHaveBeenCalledWith('19:45:00', [
      { id: 'group-a', name: "Guy's Life Group" },
      { id: 'group-b', name: 'Morning Psalms' },
    ]);
  });

  it('waits while groups are still loading (or failed) instead of wiping reminders', () => {
    mockUseUserGroups.mockReturnValue({ data: undefined });

    renderHook(() => useReminderSync(), { wrapper });

    expect(mockScheduleDailyReminders).not.toHaveBeenCalled();
  });

  it('does nothing when there is no signed-in user', () => {
    mockUseAuth.mockReturnValue({ user: null });

    renderHook(() => useReminderSync(), { wrapper });

    expect(mockScheduleDailyReminders).not.toHaveBeenCalled();
  });

  it('clears reminders (schedules an empty set) when the user has no groups', async () => {
    mockUseUserGroups.mockReturnValue({ data: [] });

    renderHook(() => useReminderSync(), { wrapper });

    await waitFor(() => expect(mockScheduleDailyReminders).toHaveBeenCalledWith('19:45:00', []));
  });

  it('does not reschedule when groups refetch with identical data', async () => {
    mockUseUserGroups.mockReturnValue({ data: [GROUP_A] });
    const { rerender } = renderHook(() => useReminderSync(), { wrapper });
    await waitFor(() => expect(mockScheduleDailyReminders).toHaveBeenCalledTimes(1));

    // New array and object identities, same ids and names.
    mockUseUserGroups.mockReturnValue({ data: [{ ...GROUP_A }] });
    rerender({});

    expect(mockScheduleDailyReminders).toHaveBeenCalledTimes(1);
  });

  it('reschedules when a group is added', async () => {
    mockUseUserGroups.mockReturnValue({ data: [GROUP_A] });
    const { rerender } = renderHook(() => useReminderSync(), { wrapper });
    await waitFor(() => expect(mockScheduleDailyReminders).toHaveBeenCalledTimes(1));

    mockUseUserGroups.mockReturnValue({ data: [GROUP_A, GROUP_B] });
    rerender({});

    await waitFor(() => expect(mockScheduleDailyReminders).toHaveBeenCalledTimes(2));
    expect(mockScheduleDailyReminders).toHaveBeenLastCalledWith('19:45:00', [
      { id: 'group-a', name: "Guy's Life Group" },
      { id: 'group-b', name: 'Morning Psalms' },
    ]);
  });

  it('reschedules when a group is renamed', async () => {
    mockUseUserGroups.mockReturnValue({ data: [GROUP_A] });
    const { rerender } = renderHook(() => useReminderSync(), { wrapper });
    await waitFor(() => expect(mockScheduleDailyReminders).toHaveBeenCalledTimes(1));

    mockUseUserGroups.mockReturnValue({ data: [{ ...GROUP_A, name: 'Renamed Group' }] });
    rerender({});

    await waitFor(() => expect(mockScheduleDailyReminders).toHaveBeenCalledTimes(2));
  });

  it('reschedules when the preferred time changes', async () => {
    const { rerender } = renderHook(() => useReminderSync(), { wrapper });
    await waitFor(() => expect(mockScheduleDailyReminders).toHaveBeenCalledTimes(1));

    mockUseAuth.mockReturnValue({ user: { ...USER, preferred_notification_time: '07:30:00' } });
    rerender({});

    await waitFor(() => expect(mockScheduleDailyReminders).toHaveBeenCalledTimes(2));
    expect(mockScheduleDailyReminders).toHaveBeenLastCalledWith('07:30:00', expect.any(Array));
  });

  it('reports scheduling failures to Sentry instead of swallowing them', async () => {
    const failure = new Error('alarm service unavailable');
    mockScheduleDailyReminders.mockRejectedValue(failure);

    renderHook(() => useReminderSync(), { wrapper });

    await waitFor(() =>
      expect(mockCaptureException).toHaveBeenCalledWith(
        failure,
        expect.objectContaining({ tags: expect.objectContaining({ context: 'daily_reminder_schedule' }) })
      )
    );
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
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['readings'] })
    );
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

  it('removes the listener on unmount', () => {
    const { unmount } = renderHook(() => useReminderSync(), { wrapper });

    unmount();

    expect(mockRemoveSubscription).toHaveBeenCalledTimes(1);
  });
});
