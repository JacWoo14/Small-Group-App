/**
 * Unit tests for src/context/AuthContext.tsx: profile loading from the initial
 * session and auth-state events, and the sign-out cleanup that cancels this
 * device's daily reminders. (Scheduling reminders lives in useReminderSync.)
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

const mockCancelReadingReminders = jest.fn();
jest.mock('../services/notifications', () => ({
  cancelReadingReminders: (...args: any[]) => mockCancelReadingReminders(...args),
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
  mockCancelReadingReminders.mockResolvedValue(undefined);
});

describe('AuthProvider profile loading', () => {
  it('loads the profile from the initial session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockEnsureUserProfile.mockResolvedValue(PROFILE);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user).toEqual(PROFILE));
    expect(result.current.needsOnboarding).toBe(false);
  });

  it("loads the profile on a 'SIGNED_IN' auth-state event", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockEnsureUserProfile.mockResolvedValue(PROFILE);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      authStateChangeCallback!('SIGNED_IN', { user: { id: 'user-1' } });
    });

    await waitFor(() => expect(result.current.user).toEqual(PROFILE));
  });

  it('sets needsOnboarding when no profile exists yet', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-new' } } } });
    mockEnsureUserProfile.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.needsOnboarding).toBe(true);
    expect(mockCancelReadingReminders).not.toHaveBeenCalled();
  });
});

describe('AuthProvider sign-out cleanup', () => {
  it('clears the user and cancels the daily reminders when the session ends', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockEnsureUserProfile.mockResolvedValue(PROFILE);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(PROFILE));
    mockCancelReadingReminders.mockClear();

    await act(async () => {
      authStateChangeCallback!('SIGNED_OUT', null);
    });

    expect(result.current.user).toBeNull();
    expect(mockCancelReadingReminders).toHaveBeenCalledTimes(1);
  });

  it('keeps the reminders when the token refreshes (session still valid)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockEnsureUserProfile.mockResolvedValue(PROFILE);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(PROFILE));
    mockCancelReadingReminders.mockClear();

    await act(async () => {
      authStateChangeCallback!('TOKEN_REFRESHED', { user: { id: 'user-1' } });
    });
    await waitFor(() => expect(result.current.user).toEqual(PROFILE));

    expect(mockCancelReadingReminders).not.toHaveBeenCalled();
  });

  it('reports a failure to cancel reminders to Sentry instead of swallowing it', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockEnsureUserProfile.mockResolvedValue(PROFILE);
    const cancelError = new Error('cancelScheduledNotificationAsync failed');
    mockCancelReadingReminders.mockRejectedValue(cancelError);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(PROFILE));

    await act(async () => {
      authStateChangeCallback!('SIGNED_OUT', null);
    });

    await waitFor(() =>
      expect(mockCaptureException).toHaveBeenCalledWith(
        cancelError,
        expect.objectContaining({ tags: expect.objectContaining({ context: 'daily_reminder_cancel' }) })
      )
    );
  });
});
