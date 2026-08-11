/**
 * Unit tests for src/services/auth.ts
 *
 * createUserProfile was changed from `.insert()` to `.upsert()` as part of
 * the phase-4 diff (see OnboardingScreen's new submitting-ref double-submit
 * guard, added in the same diff — upsert makes a retried/duplicate
 * onboarding submit idempotent instead of failing with a unique-constraint
 * error). That insert→upsert change is a real behavior modification with no
 * prior test coverage, so it's tested here per the regression rule.
 */

const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockUpsert = jest.fn((_payload: any) => ({ select: mockSelect }));
const mockEq = jest.fn();
const mockSelectForEnsure = jest.fn(() => ({ eq: mockEq }));

jest.mock('../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: mockUpsert,
      select: mockSelectForEnsure,
    })),
  },
}));

import { createUserProfile, ensureUserProfile } from '../services/auth';

beforeEach(() => {
  jest.clearAllMocks();
  mockUpsert.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ single: mockSingle });
  mockSelectForEnsure.mockReturnValue({ eq: mockEq });
});

describe('createUserProfile', () => {
  it('upserts (not inserts) the profile row, keyed by id', async () => {
    const record = { id: 'u1', email: 'a@b.com', display_name: 'Ann' };
    mockSingle.mockResolvedValue({ data: record, error: null });

    const result = await createUserProfile({
      id: 'u1',
      email: 'a@b.com',
      displayName: 'Ann',
      notificationTime: '07:00',
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'u1',
        email: 'a@b.com',
        display_name: 'Ann',
        preferred_notification_time: '07:00',
      })
    );
    expect(result).toEqual(record);
  });

  it('is idempotent: a second call with the same id does not throw a duplicate-key error', async () => {
    // Regression: with plain .insert(), calling this twice for the same id
    // (e.g. OnboardingScreen retried after a slow/ambiguous network response)
    // would throw a 23505 unique-violation. upsert() must not.
    mockSingle.mockResolvedValue({ data: { id: 'u1' }, error: null });

    await createUserProfile({ id: 'u1', email: 'a@b.com', displayName: 'Ann', notificationTime: '07:00' });
    await expect(
      createUserProfile({ id: 'u1', email: 'a@b.com', displayName: 'Ann', notificationTime: '07:00' })
    ).resolves.toEqual({ id: 'u1' });

    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it('includes an auto-detected timezone in the upserted row', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'u1' }, error: null });

    await createUserProfile({ id: 'u1', email: 'a@b.com', displayName: 'Ann', notificationTime: '07:00' });

    const [payload] = mockUpsert.mock.calls[0];
    expect(typeof payload.timezone).toBe('string');
    expect(payload.timezone.length).toBeGreaterThan(0);
  });

  it('throws when the upsert returns an error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: '23514', message: 'check violation' } });

    await expect(
      createUserProfile({ id: 'u1', email: 'a@b.com', displayName: 'Ann', notificationTime: '07:00' })
    ).rejects.toEqual({ code: '23514', message: 'check violation' });
  });
});

describe('ensureUserProfile', () => {
  it('returns the existing profile when one is found', async () => {
    const record = { id: 'u1', email: 'a@b.com' };
    mockEq.mockReturnValue({ single: jest.fn().mockResolvedValue({ data: record, error: null }) });

    const result = await ensureUserProfile('u1', 'a@b.com');

    expect(result).toEqual(record);
  });

  it('returns null (needs onboarding) when no profile is found', async () => {
    mockEq.mockReturnValue({ single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }) });

    const result = await ensureUserProfile('new-user', 'new@b.com');

    expect(result).toBeNull();
  });
});
