-- SECURITY/CORRECTNESS FIX: the swipeable date-navigation feature bounds
-- selectable dates client-side to [today-30, today+7] (see
-- src/utils/dateNav.ts), but markComplete() had no server-side check —
-- a direct API call could insert a future-dated completion, which
-- calculateStreakFromDates (src/services/stats.ts) doesn't recognize as
-- a valid "current" entry, silently zeroing the user's streak.
--
-- Mirrors the client's own PAST_DAYS_LIMIT/FUTURE_DAYS_LIMIT window.
ALTER TABLE reading_completions
  ADD CONSTRAINT reading_date_within_window
  CHECK (reading_date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE + 7);
