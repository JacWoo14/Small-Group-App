-- SECURITY/CORRECTNESS FIX: the swipeable date-navigation feature bounds
-- selectable dates client-side to [today-30, today+7] (see
-- src/utils/dateNav.ts), but markComplete() had no server-side check —
-- a direct API call could insert a future-dated completion, which
-- calculateStreakFromDates (src/services/stats.ts) doesn't recognize as
-- a valid "current" entry, silently zeroing the user's streak.
--
-- Upper bound only, matching FUTURE_DAYS_LIMIT. No lower bound: the app
-- has months of legitimate history older than PAST_DAYS_LIMIT (30 days),
-- and retroactive completion of old readings is intentional, expected
-- behavior, not a threat — only completions dated in the future are the
-- actual gap this migration closes.
ALTER TABLE reading_completions
  ADD CONSTRAINT reading_date_within_window
  CHECK (reading_date <= CURRENT_DATE + 7);
