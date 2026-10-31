/**
 * Unit tests for src/context/AuthContext.tsx's handleProfileLoaded gating
 * logic — specifically, that daily-reminder scheduling only fires on
 * initial app load and the 'SIGNED_IN' auth event, not on every auth-state
 * change (e.g. TOKEN_REFRESHED). This is a flagged regression risk: the
 * gating depends on an exact string match against Supabase SDK event names
 * with no test previously guarding it.
 */

import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';

let authStateChangeCallback: ((event: string, session: any) => void) | null = null;

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn((callback) => {
  authStateChangeCallback = callback;
  return { data: { subscription: { unsubscribe: jest.fn() } } };
});

jest.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: any[]) => mockGetSession(...args),
      onAuthStateChange: (callback: any) => mockOnAuthStateChange(callback),
      setSession: jest.fn(),
    },
  },
}));

const mockEnsureUserProfile = jest.fn();
jest.mock('../services/auth', () => ({
  ensureUserProfile: (...args: any[]) => mockEnsureUserProfile(...args),
}));

const mockScheduleDailyReminder = jest.fn();
const mockCancelDailyReminder = jest.fn();
jest.mock('../services/notifications', () => ({
  scheduleDailyReminder: (...args: any[]) => mockScheduleDailyReminder(...args),
  cancelDailyReminder: (...args: any[]) => mockCancelDailyReminder(...args),
}));

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
}));

const mockCaptureException = jest.fn();
jest.mock('@sentry/react-native', () => ({
  captureException: (...args: any[]) => mockCaptureException(...args),
}));

import { AuthProvider, useAuth } from '../context/AuthContext';

const PROFILE = {
  id: 'user-1',
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'UTC',
  preferred_notification_time: '07:00:00',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  authStateChangeCallback = null;
  mockScheduleDailyReminder.mockResolvedValue(true);
  mockCancelDailyReminder.mockResolvedValue(undefined);
});

describe('AuthProvider daily-reminder gating', () => {
  it('schedules the daily reminder on initial session load', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockEnsureUserProfile.mockResolvedValue(PROFILE);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user).toEqual(PROFILE));

    expect(mockScheduleDailyReminder).toHaveBeenCalledWith('07:00:00');
  });

  it("schedules the daily reminder on a 'SIGNED_IN' auth-state event", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockEnsureUserProfile.mockResolvedValue(PROFILE);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockScheduleDailyReminder.mockClear();

    await act(async () => {
      authStateChangeCallback!('SIGNED_IN', { user: { id: 'user-1' } });
    });
    await waitFor(() => expect(result.current.user).toEqual(PROFILE));

    expect(mockScheduleDailyReminder).toHaveBeenCalledWith('07:00:00');
  });

  it("does NOT reschedule the daily reminder on a 'TOKEN_REFRESHED' auth-state event (regression guard)", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockEnsureUserProfile.mockResolvedValue(PROFILE);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockScheduleDailyReminder.mockClear();

    await act(async () => {
      authStateChangeCallback!('TOKEN_REFRESHED', { user: { id: 'user-1' } });
    });
    await waitFor(() => expect(result.current.user).toEqual(PROFILE));

    expect(mockScheduleDailyReminder).not.toHaveBeenCalled();
  });

  it('clears the user and cancels the daily reminder when the session ends (sign out)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockEnsureUserProfile.mockResolvedValue(PROFILE);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(PROFILE));
    mockScheduleDailyReminder.mockClear();
    mockCancelDailyReminder.mockClear();

    await act(async () => {
      authStateChangeCallback!('SIGNED_OUT', null);
    });

    expect(result.current.user).toBeNull();
    expect(mockScheduleDailyReminder).not.toHaveBeenCalled();
    expect(mockCancelDailyReminder).toHaveBeenCalledTimes(1);
  });

  it('reports reminder scheduling failures to Sentry instead of swallowing them (regression guard)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockEnsureUserProfile.mockResolvedValue(PROFILE);
    const scheduleError = new Error('scheduleNotificationAsync failed');
    mockScheduleDailyReminder.mockRejectedValue(scheduleError);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user).toEqual(PROFILE));
    await waitFor(() =>
      expect(mockCaptureException).toHaveBeenCalledWith(
        scheduleError,
        expect.objectContaining({ tags: expect.objectContaining({ context: 'daily_reminder_schedule' }) })
      )
    );
  });

  it('sets needsOnboarding when no profile exists yet, without scheduling a reminder', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-new' } } } });
    mockEnsureUserProfile.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.needsOnboarding).toBe(true);
    expect(mockScheduleDailyReminder).not.toHaveBeenCalled();
  });
});
