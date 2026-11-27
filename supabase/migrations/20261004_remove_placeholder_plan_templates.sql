-- Removes the 5 plan_templates rows seeded by 20260919_seed_plan_templates.sql
-- (created 2026-09-20 00:24:17 UTC, before the 8 sourced plans were seeded at
-- 19:46 and 20:00 that day). These were a deliberate earlier seed, not test
-- data; an earlier version of this comment wrongly called them placeholders.
--
-- They're short, single-book plans (7/50/21/31/30 days) -- exactly the
-- category the app owner decided belongs to custom plan creation, not the
-- curated long-term/complex catalog (see TODOS.md Phase 3 notes,
-- 2026-09-20). Deleting by exact name for precision; plan_template_readings
-- cascade-delete with their parent (ON DELETE CASCADE).

DO $$
DECLARE
  removed_count INTEGER;
BEGIN
  WITH removed AS (
    DELETE FROM plan_templates
    WHERE name IN (
      '7-Day Introduction to Jesus',
      'Genesis in 50 Days',
      'Gospel of John',
      'Proverbs in a Month',
      'Psalms: The First 30'
    )
    AND created_at < '2026-09-20 01:00:00+00'
    RETURNING id
  )
  SELECT COUNT(*) INTO removed_count FROM removed;

  IF removed_count <> 5 THEN
    RAISE EXCEPTION
      'Expected to remove exactly 5 placeholder plan_templates rows, removed %. Aborting -- verify the current data manually (the created_at guard may have excluded a row, or one was already removed).',
      removed_count;
  END IF;

  RAISE NOTICE 'Removed % placeholder plan_templates row(s) and their cascaded plan_template_readings.', removed_count;
END $$;
