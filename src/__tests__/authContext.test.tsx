/**
 * Unit tests for src/context/AuthContext.tsx's handleProfileLoaded gating
 * logic — specifically, that push-notification registration only fires on
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

const mockRegisterForPushNotifications = jest.fn();
jest.mock('../services/notifications', () => ({
  registerForPushNotifications: (...args: any[]) => mockRegisterForPushNotifications(...args),
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
  mockRegisterForPushNotifications.mockResolvedValue(undefined);
});

describe('AuthProvider push-registration gating', () => {
  it('registers for push notifications on initial session load', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockEnsureUserProfile.mockResolvedValue(PROFILE);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user).toEqual(PROFILE));

    expect(mockRegisterForPushNotifications).toHaveBeenCalledWith('user-1');
  });

  it("registers for push notifications on a 'SIGNED_IN' auth-state event", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockEnsureUserProfile.mockResolvedValue(PROFILE);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockRegisterForPushNotifications.mockClear();

    await act(async () => {
      authStateChangeCallback!('SIGNED_IN', { user: { id: 'user-1' } });
    });
    await waitFor(() => expect(result.current.user).toEqual(PROFILE));

    expect(mockRegisterForPushNotifications).toHaveBeenCalledWith('user-1');
  });

  it("does NOT register for push notifications on a 'TOKEN_REFRESHED' auth-state event (regression guard)", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockEnsureUserProfile.mockResolvedValue(PROFILE);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockRegisterForPushNotifications.mockClear();

    await act(async () => {
      authStateChangeCallback!('TOKEN_REFRESHED', { user: { id: 'user-1' } });
    });
    await waitFor(() => expect(result.current.user).toEqual(PROFILE));

    expect(mockRegisterForPushNotifications).not.toHaveBeenCalled();
  });

  it('clears the user and does not register for push when the session ends (sign out)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockEnsureUserProfile.mockResolvedValue(PROFILE);

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(PROFILE));
    mockRegisterForPushNotifications.mockClear();

    await act(async () => {
      authStateChangeCallback!('SIGNED_OUT', null);
    });

    expect(result.current.user).toBeNull();
    expect(mockRegisterForPushNotifications).not.toHaveBeenCalled();
  });

  it('reports push registration failures to Sentry instead of swallowing them (regression guard)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
    mockEnsureUserProfile.mockResolvedValue(PROFILE);
    const registrationError = new Error('getExpoPushTokenAsync failed');
    mockRegisterForPushNotifications.mockRejectedValue(registrationError);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user).toEqual(PROFILE));
    await waitFor(() =>
      expect(mockCaptureException).toHaveBeenCalledWith(
        registrationError,
        expect.objectContaining({ tags: expect.objectContaining({ context: 'push_registration' }) })
      )
    );
  });

  it('sets needsOnboarding when no profile exists yet, without registering for push', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-new' } } } });
    mockEnsureUserProfile.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.needsOnboarding).toBe(true);
    expect(mockRegisterForPushNotifications).not.toHaveBeenCalled();
  });
});
