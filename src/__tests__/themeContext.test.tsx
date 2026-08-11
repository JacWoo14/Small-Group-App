/**
 * Unit tests for ThemeContext's setThemeId — the optimistic-update,
 * RLS-silent-failure detection, rollback-on-error, and generation-based
 * race guard have real branching logic that resolveThemeId's pure-function
 * tests don't exercise on their own.
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';

const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockUpdate = jest.fn((_payload: any) => ({ eq: mockEq }));

jest.mock('../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({ update: mockUpdate })),
  },
}));

const mockSetUser = jest.fn();
let mockUser: any = { id: 'user-1', theme_id: 'sage' };
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, setUser: mockSetUser }),
}));

const mockAlert = jest.fn();
jest.mock('react-native', () => ({
  Alert: { alert: (...args: any[]) => mockAlert(...args) },
}));

import { ThemeProvider, useTheme } from '../context/ThemeContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'user-1', theme_id: 'sage' };
  // Default chain: update().eq().select('id') → { data: [{id:'user-1'}], error: null }
  mockEq.mockReturnValue({ select: mockSelect });
  mockSelect.mockResolvedValue({ data: [{ id: 'user-1' }], error: null });
});

describe('setThemeId — success path', () => {
  it('commits the new theme and calls setUser once the write succeeds', async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(async () => {
      await result.current.setThemeId('navy');
    });

    expect(result.current.themeId).toBe('navy');
    expect(result.current.pendingThemeId).toBeNull();
    expect(mockSetUser).toHaveBeenCalledWith(expect.objectContaining({ theme_id: 'navy' }));
  });

  it('sets pendingThemeId to the tapped id while the write is in flight', async () => {
    let resolveSelect: (v: any) => void;
    mockSelect.mockReturnValue(new Promise((res) => { resolveSelect = res; }));

    const { result } = renderHook(() => useTheme(), { wrapper });

    let writePromise: Promise<void>;
    act(() => { writePromise = result.current.setThemeId('burgundy'); });

    await waitFor(() => expect(result.current.pendingThemeId).toBe('burgundy'));

    await act(async () => {
      resolveSelect!({ data: [{ id: 'user-1' }], error: null });
      await writePromise;
    });

    expect(result.current.pendingThemeId).toBeNull();
  });
});

describe('setThemeId — failure paths', () => {
  it('reverts themeId and alerts when the Supabase write returns an error', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'network failure' } });
    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(async () => {
      await result.current.setThemeId('navy');
    });

    expect(result.current.themeId).toBe('sage');
    expect(result.current.pendingThemeId).toBeNull();
    expect(mockSetUser).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('Error', 'network failure');
  });

  it('reverts and alerts when RLS silently blocks the update (0 rows, no error)', async () => {
    mockSelect.mockResolvedValue({ data: [], error: null });
    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(async () => {
      await result.current.setThemeId('slate');
    });

    expect(result.current.themeId).toBe('sage');
    expect(mockSetUser).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith(
      'Error',
      expect.stringContaining('permission')
    );
  });
});

describe('setThemeId — race guard', () => {
  it('keeps the latest successful theme when an earlier write resolves after a newer one', async () => {
    let resolveFirst: (v: any) => void;
    mockSelect
      .mockImplementationOnce(() => new Promise((res) => { resolveFirst = res; }))
      .mockResolvedValueOnce({ data: [{ id: 'user-1' }], error: null });

    const { result } = renderHook(() => useTheme(), { wrapper });

    let firstWrite: Promise<void>;
    act(() => { firstWrite = result.current.setThemeId('navy'); });
    await act(async () => { await result.current.setThemeId('burgundy'); });

    await act(async () => {
      resolveFirst!({ data: [{ id: 'user-1' }], error: null });
      await firstWrite;
    });

    expect(result.current.themeId).toBe('burgundy');
    expect(mockSetUser).toHaveBeenLastCalledWith(expect.objectContaining({ theme_id: 'burgundy' }));
  });

  it('does not revert to a stale value when an earlier write fails after a newer one already succeeded', async () => {
    let rejectFirst: (v: any) => void;
    mockSelect
      .mockImplementationOnce(() => new Promise((_res, rej) => { rejectFirst = rej; }))
      .mockResolvedValueOnce({ data: [{ id: 'user-1' }], error: null });

    const { result } = renderHook(() => useTheme(), { wrapper });

    let firstWrite: Promise<void>;
    act(() => {
      firstWrite = result.current.setThemeId('navy').catch(() => {});
    });
    await act(async () => { await result.current.setThemeId('burgundy'); });

    await act(async () => {
      rejectFirst!(new Error('slow failure'));
      await firstWrite;
    });

    expect(result.current.themeId).toBe('burgundy');
    expect(mockAlert).not.toHaveBeenCalled();
  });
});

describe('setThemeId — no authenticated user', () => {
  it('is a no-op when called with no user signed in', async () => {
    mockUser = null;
    const { result } = renderHook(() => useTheme(), { wrapper });

    await act(async () => {
      await result.current.setThemeId('navy');
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSetUser).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });
});

describe('setThemeId — resync on account switch', () => {
  it('resyncs themeId when the authenticated user changes within one session', async () => {
    const { result, rerender } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.themeId).toBe('sage');

    mockUser = { id: 'user-2', theme_id: 'burgundy' };
    rerender({});

    await waitFor(() => expect(result.current.themeId).toBe('burgundy'));
  });
});
