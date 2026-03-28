import { calculateStreakFromDates } from '../services/stats';

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
});
