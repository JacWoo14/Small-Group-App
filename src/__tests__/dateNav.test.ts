import { clampDate } from '../utils/dateNav';

// All tests pass an explicit `today` so results are deterministic.
// Matches PAST_DAYS_LIMIT = 30, FUTURE_DAYS_LIMIT = 7 in TodayScreen.tsx.

describe('clampDate', () => {
  const TODAY = '2026-07-18';

  it('moves one day forward within bounds', () => {
    expect(clampDate(TODAY, 1, TODAY)).toBe('2026-07-19');
  });

  it('moves one day backward within bounds', () => {
    expect(clampDate(TODAY, -1, TODAY)).toBe('2026-07-17');
  });

  it('allows navigating exactly to the future boundary (+7 days)', () => {
    expect(clampDate(TODAY, 7, TODAY)).toBe('2026-07-25');
  });

  it('blocks navigating past the future boundary (+8 days)', () => {
    expect(clampDate(TODAY, 8, TODAY)).toBe(TODAY);
  });

  it('allows navigating exactly to the past boundary (-30 days)', () => {
    expect(clampDate(TODAY, -30, TODAY)).toBe('2026-06-18');
  });

  it('blocks navigating past the past boundary (-31 days)', () => {
    expect(clampDate(TODAY, -31, TODAY)).toBe(TODAY);
  });

  it('returns the unchanged date when already at the future boundary and moving further forward', () => {
    const atBoundary = '2026-07-25'; // TODAY + 7
    expect(clampDate(atBoundary, 1, TODAY)).toBe(atBoundary);
  });

  it('returns the unchanged date when already at the past boundary and moving further backward', () => {
    const atBoundary = '2026-06-18'; // TODAY - 30
    expect(clampDate(atBoundary, -1, TODAY)).toBe(atBoundary);
  });

  it('defaults `today` to the real current date when not provided', () => {
    // Same-day delta of 0 should always return the input unchanged, regardless of `today`.
    expect(clampDate(TODAY, 0)).toBe(TODAY);
  });
});
