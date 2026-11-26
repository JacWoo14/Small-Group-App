// ─── Supabase client mock (for getUserStreak) ──────────────────────────────
// calculateStreakFromDates / getActivityDates / toLocalDateString are
// pure and need no mock; getUserStreak wraps a Supabase query and is tested
// below with a mocked client, matching the pattern in completions.test.ts.

const mockOrder = jest.fn();
const mockEq = jest.fn(() => ({ order: mockOrder }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockRpc = jest.fn();

jest.mock('../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({ select: mockSelect })),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  calculateStreakFromDates,
  getActivityDates,
  toLocalDateString,
  getUserStreak,
  getYesterdayGroupRecap,
} from '../services/stats';

beforeEach(() => {
  jest.clearAllMocks();
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ order: mockOrder });
});

// Note: getYesterdayGroupRecap's new-member filter (joined_at < yesterday)
// is enforced via a Supabase query filter and is covered by manual testing.
// The streak calculation logic below is fully pure and unit-tested here.

// All tests pass an explicit `today` so results are deterministic

describe('calculateStreakFromDates', () => {
  const TODAY = '2026-03-15';
  const YESTERDAY = '2026-03-14';

  it('returns zeros for empty input', () => {
    expect(calculateStreakFromDates([], TODAY)).toEqual({ current: 0, longest: 0 });
  });

  it('returns streak of 1 when only today is present', () => {
    expect(calculateStreakFromDates([TODAY], TODAY)).toEqual({ current: 1, longest: 1 });
  });

  it('returns streak of 1 when only yesterday is present', () => {
    expect(calculateStreakFromDates([YESTERDAY], TODAY)).toEqual({ current: 1, longest: 1 });
  });

  it('returns current=0 when most recent date is 2 days ago', () => {
    const result = calculateStreakFromDates(['2026-03-13'], TODAY);
    expect(result.current).toBe(0);
  });

  it('counts a multi-day current streak starting from today', () => {
    const dates = [TODAY, YESTERDAY, '2026-03-13'];
    expect(calculateStreakFromDates(dates, TODAY)).toEqual({ current: 3, longest: 3 });
  });

  it('counts a multi-day current streak starting from yesterday', () => {
    const dates = [YESTERDAY, '2026-03-13', '2026-03-12'];
    expect(calculateStreakFromDates(dates, TODAY)).toEqual({ current: 3, longest: 3 });
  });

  it('breaks streak when a day is missed', () => {
    // today and yesterday present, but gap before that
    const dates = [TODAY, YESTERDAY, '2026-03-10', '2026-03-09'];
    const result = calculateStreakFromDates(dates, TODAY);
    expect(result.current).toBe(2);
    expect(result.longest).toBe(2);
  });

  it('tracks longest streak correctly when current is shorter', () => {
    // Old long streak Jan 1-5, current streak just today
    const dates = [
      TODAY,
      '2026-01-05', '2026-01-04', '2026-01-03', '2026-01-02', '2026-01-01',
    ];
    const result = calculateStreakFromDates(dates, TODAY);
    expect(result.current).toBe(1);
    expect(result.longest).toBe(5);
  });

  it('deduplicates dates from multiple groups', () => {
    // Same date appears twice (two groups completed)
    const dates = [TODAY, TODAY, YESTERDAY, YESTERDAY];
    expect(calculateStreakFromDates(dates, TODAY)).toEqual({ current: 2, longest: 2 });
  });

  it('handles dates in any order', () => {
    const dates = ['2026-03-13', TODAY, YESTERDAY];
    expect(calculateStreakFromDates(dates, TODAY)).toEqual({ current: 3, longest: 3 });
  });

  it('handles a single date that is not today or yesterday', () => {
    const result = calculateStreakFromDates(['2026-01-01'], TODAY);
    expect(result.current).toBe(0);
    expect(result.longest).toBe(1);
  });

  it('returns longest=1 for two non-consecutive dates neither of which is today/yesterday', () => {
    // Regression: previously returned longest=0 because loop only updated longest on diff===1
    const result = calculateStreakFromDates(['2026-01-01', '2026-01-15'], TODAY);
    expect(result.current).toBe(0);
    expect(result.longest).toBe(1);
  });

  it('returns longest=1 for many scattered non-consecutive dates', () => {
    const dates = ['2026-01-01', '2026-01-10', '2026-01-20', '2026-02-05'];
    const result = calculateStreakFromDates(dates, TODAY);
    expect(result.current).toBe(0);
    expect(result.longest).toBe(1);
  });
});

describe('toLocalDateString', () => {
  it('renders a UTC timestamp as the correct calendar date in a negative-offset timezone', () => {
    // 2026-03-15T02:00:00Z is still 2026-03-14 evening in US Central time
    expect(toLocalDateString('2026-03-15T02:00:00.000Z', 'America/Chicago')).toBe('2026-03-14');
  });

  it('renders a UTC timestamp as the correct calendar date in UTC', () => {
    expect(toLocalDateString('2026-03-15T02:00:00.000Z', 'UTC')).toBe('2026-03-15');
  });

  it('renders a UTC timestamp as the correct calendar date in a positive-offset timezone', () => {
    // 2026-03-14T23:00:00Z is already 2026-03-15 morning in Tokyo (UTC+9)
    expect(toLocalDateString('2026-03-14T23:00:00.000Z', 'Asia/Tokyo')).toBe('2026-03-15');
  });

  it('falls back to UTC instead of throwing for an empty/malformed timezone (regression guard)', () => {
    // A malformed IANA zone (e.g. an empty string on a legacy row) previously
    // threw RangeError from Intl.DateTimeFormat, which getUserStreak let
    // propagate — silently showing "No streak yet" to a user with a real streak.
    expect(() => toLocalDateString('2026-03-15T02:00:00.000Z', '')).not.toThrow();
    expect(toLocalDateString('2026-03-15T02:00:00.000Z', '')).toBe('2026-03-15');
    expect(() => toLocalDateString('2026-03-15T02:00:00.000Z', 'Not/AZone')).not.toThrow();
  });
});

describe('getActivityDates', () => {
  const TZ = 'America/Chicago';

  it('returns the calendar day a completion was made on', () => {
    const rows = [{ completed_at: '2026-03-15T18:00:00.000Z' }];
    expect(getActivityDates(rows, TZ)).toEqual(['2026-03-15']);
  });

  it('uses the user timezone to decide the activity day', () => {
    // 02:00Z on 03-15 is still the evening of 03-14 in Chicago
    expect(getActivityDates([{ completed_at: '2026-03-15T02:00:00.000Z' }], TZ)).toEqual(['2026-03-14']);
  });

  it('excludes rows with a null completed_at instead of throwing', () => {
    expect(getActivityDates([{ completed_at: null }], TZ)).toEqual([]);
  });

  it('deduplicates multiple completions on the same day', () => {
    const rows = [
      { completed_at: '2026-03-15T14:00:00.000Z' },
      { completed_at: '2026-03-15T15:00:00.000Z' },
    ];
    expect(getActivityDates(rows, TZ)).toEqual(['2026-03-15']);
  });

  it('a mass-backfill session only credits the one day it happened, not all 10', () => {
    const rows = Array.from({ length: 10 }, () => ({ completed_at: '2026-03-15T18:00:00.000Z' }));
    const days = getActivityDates(rows, TZ);
    expect(days).toEqual(['2026-03-15']);
    expect(calculateStreakFromDates(days, '2026-03-15')).toEqual({ current: 1, longest: 1 });
  });

  it('keeps a streak alive for a user who is always one day behind', () => {
    // Reads a day late every day: reading_dates lag, completed_at is daily.
    const rows = ['12', '13', '14', '15'].map((d) => ({ completed_at: `2026-03-${d}T18:00:00.000Z` }));
    expect(calculateStreakFromDates(getActivityDates(rows, TZ), '2026-03-15')).toEqual({ current: 4, longest: 4 });
  });
});

describe('getUserStreak', () => {
  it('queries completed_at for the given user, ordered descending', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    await getUserStreak('user-1', 'UTC');

    expect(mockSelect).toHaveBeenCalledWith('completed_at');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mockOrder).toHaveBeenCalledWith('completed_at', { ascending: false });
  });

  it('returns zeros when there are no completion rows', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    expect(await getUserStreak('user-1', 'UTC')).toEqual({ current: 0, longest: 0 });
  });

  it('returns zeros when data is null', async () => {
    mockOrder.mockResolvedValue({ data: null, error: null });

    expect(await getUserStreak('user-1', 'UTC')).toEqual({ current: 0, longest: 0 });
  });

  it('throws when the query returns an error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'connection reset' } });

    await expect(getUserStreak('user-1', 'UTC')).rejects.toEqual({ message: 'connection reset' });
  });

  it('counts recent completions toward the streak using the user timezone', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-15T18:00:00.000Z'));
    mockOrder.mockResolvedValue({
      data: [
        { completed_at: '2026-03-15T17:00:00.000Z' },
        { completed_at: '2026-03-14T17:00:00.000Z' },
      ],
      error: null,
    });

    const result = await getUserStreak('user-1', 'America/Chicago');
    jest.useRealTimers();

    expect(result).toEqual({ current: 2, longest: 2 });
  });
});

describe('getYesterdayGroupRecap', () => {
  it('returns an empty rest-day recap when yesterday had no reading', async () => {
    const single = jest.fn().mockResolvedValue({ data: { created_at: '2020-01-01T00:00:00Z' }, error: null });
    mockEq.mockReturnValue({ single } as any);
    mockRpc.mockResolvedValue({ data: false, error: null });

    const recap = await getYesterdayGroupRecap('group-1');

    expect(recap.rest_day).toBe(true);
    expect(recap.completions).toEqual([]);
    expect(mockRpc).toHaveBeenCalledWith('group_has_reading', {
      p_group_id: 'group-1',
      p_date: recap.date,
    });
  });
});
