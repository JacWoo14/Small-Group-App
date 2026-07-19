import { calculateStreakFromDates, filterSameDayCompletions, toLocalDateString } from '../services/stats';

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
});

describe('filterSameDayCompletions', () => {
  const TZ = 'America/Chicago';

  it('counts a completion made on the same calendar day as reading_date', () => {
    const rows = [{ reading_date: '2026-03-15', completed_at: '2026-03-15T18:00:00.000Z' }];
    expect(filterSameDayCompletions(rows, TZ)).toEqual(['2026-03-15']);
  });

  it('excludes a retroactively-backfilled completion (completed_at on a different day than reading_date)', () => {
    // Regression: this is the exact "backfill inflates streak" bug reported —
    // a user marks 2026-03-01 complete today (2026-03-15); it must not count.
    const rows = [{ reading_date: '2026-03-01', completed_at: '2026-03-15T18:00:00.000Z' }];
    expect(filterSameDayCompletions(rows, TZ)).toEqual([]);
  });

  it('counts a date if ANY group completion for that date was same-day, even if another was backfilled', () => {
    const rows = [
      { reading_date: '2026-03-10', completed_at: '2026-03-15T18:00:00.000Z' }, // backfilled, group A
      { reading_date: '2026-03-10', completed_at: '2026-03-10T18:00:00.000Z' }, // same-day, group B
    ];
    expect(filterSameDayCompletions(rows, TZ)).toEqual(['2026-03-10']);
  });

  it('excludes rows with a null completed_at instead of throwing', () => {
    const rows = [{ reading_date: '2026-03-15', completed_at: null }];
    expect(filterSameDayCompletions(rows, TZ)).toEqual([]);
  });

  it('deduplicates when multiple same-day groups share a reading_date', () => {
    const rows = [
      { reading_date: '2026-03-15', completed_at: '2026-03-15T14:00:00.000Z' },
      { reading_date: '2026-03-15', completed_at: '2026-03-15T15:00:00.000Z' },
    ];
    expect(filterSameDayCompletions(rows, TZ)).toEqual(['2026-03-15']);
  });

  it('a mass-backfill session only credits the one day actually completed today, not all 10', () => {
    // The exact scenario from the bug report: sitting down today and
    // checking off the last 10 days in one sitting must not read as a
    // 10-day streak — only today (genuinely completed today) counts.
    const rows = [
      '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10',
      '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14', '2026-03-15',
    ].map((reading_date) => ({ reading_date, completed_at: '2026-03-15T18:00:00.000Z' }));

    const validDates = filterSameDayCompletions(rows, TZ);
    expect(validDates).toEqual(['2026-03-15']);
    expect(calculateStreakFromDates(validDates, '2026-03-15')).toEqual({ current: 1, longest: 1 });
  });
});
