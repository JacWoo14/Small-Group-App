/**
 * Unit tests for the date-scoped hooks in src/hooks/useGroups.ts:
 *   - useReadingsForDate (query key includes date; refetchInterval only for today)
 *   - useMarkComplete (dismisses the notification only when marking today's
 *     reading, and scopes cache invalidation to the specific date)
 *
 * useAuth, the completions service, and the notifications service are all
 * mocked so no Supabase/network calls happen.
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format } from 'date-fns';

const mockUseAuth = jest.fn();
jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockGetTodaysReadings = jest.fn();
const mockMarkComplete = jest.fn();
jest.mock('../services/completions', () => ({
  getTodaysReadings: (...args: any[]) => mockGetTodaysReadings(...args),
  markComplete: (...args: any[]) => mockMarkComplete(...args),
}));

const mockDismissTodayNotification = jest.fn();
jest.mock('../services/notifications', () => ({
  dismissTodayNotification: (...args: any[]) => mockDismissTodayNotification(...args),
}));

const mockCaptureException = jest.fn();
jest.mock('@sentry/react-native', () => ({
  captureException: (...args: any[]) => mockCaptureException(...args),
}));

import { useReadingsForDate, useMarkComplete } from '../hooks/useGroups';

const TODAY = format(new Date(), 'yyyy-MM-dd');
const PAST_DATE = '2020-01-01';
const TEST_USER = { id: 'user-1', timezone: 'UTC' };

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: TEST_USER });
  mockGetTodaysReadings.mockResolvedValue([]);
  mockMarkComplete.mockResolvedValue({ id: 'completion-1' });
  mockDismissTodayNotification.mockResolvedValue(undefined);
});

describe('useReadingsForDate', () => {
  it('includes the date in the query and calls getTodaysReadings with it', async () => {
    const { result } = renderHook(() => useReadingsForDate(PAST_DATE), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGetTodaysReadings).toHaveBeenCalledWith('user-1', 'UTC', PAST_DATE);
  });

  it('does not query when there is no authenticated user', () => {
    mockUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useReadingsForDate(TODAY), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetTodaysReadings).not.toHaveBeenCalled();
  });

  it('auto-refetches on an interval for today', async () => {
    jest.useFakeTimers();
    try {
      const { result } = renderHook(() => useReadingsForDate(TODAY), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGetTodaysReadings).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(60 * 1000);
      });
      await waitFor(() => expect(mockGetTodaysReadings).toHaveBeenCalledTimes(2));
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not auto-refetch on an interval for a past date', async () => {
    jest.useFakeTimers();
    try {
      const { result } = renderHook(() => useReadingsForDate(PAST_DATE), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockGetTodaysReadings).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(5 * 60 * 1000);
      });
      expect(mockGetTodaysReadings).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('useMarkComplete', () => {
  it("dismisses the notification when marking today's reading", async () => {
    const { result } = renderHook(() => useMarkComplete(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ groupId: 'group-1', readingDate: TODAY });
    });

    expect(mockDismissTodayNotification).toHaveBeenCalledWith('group-1');
  });

  it('does NOT dismiss the notification when marking a past date', async () => {
    const { result } = renderHook(() => useMarkComplete(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ groupId: 'group-1', readingDate: PAST_DATE });
    });

    expect(mockDismissTodayNotification).not.toHaveBeenCalled();
  });

  it('calls markComplete with the authenticated user id, group, and date', async () => {
    const { result } = renderHook(() => useMarkComplete(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ groupId: 'group-9', readingDate: PAST_DATE });
    });

    expect(mockMarkComplete).toHaveBeenCalledWith('user-1', 'group-9', PAST_DATE);
  });

  it('surfaces a mutation error (e.g. "Already completed") to the caller', async () => {
    mockMarkComplete.mockRejectedValue(new Error('Already completed'));
    const { result } = renderHook(() => useMarkComplete(), { wrapper });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ groupId: 'group-1', readingDate: TODAY });
      })
    ).rejects.toThrow('Already completed');
  });

  it('reports a notification-dismiss failure to Sentry instead of swallowing it (regression guard)', async () => {
    mockDismissTodayNotification.mockRejectedValue(new Error('dismiss failed'));
    const { result } = renderHook(() => useMarkComplete(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ groupId: 'group-1', readingDate: TODAY });
    });

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: expect.objectContaining({ context: 'dismiss_notification' }) })
    );
  });
});
