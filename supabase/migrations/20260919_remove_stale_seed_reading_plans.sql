-- Remove the 4 leftover pre-migration seed/test reading plans:
-- "30-Day Psalms", "7-Day Gospels Sampler", "90-Day New Testament",
-- "One Year Bible" (all is_public=true, created_at 2026-02-14).
--
-- These predate the date-first model: every plan_readings row under them has
-- scheduled_date = null with only day_number set, and passages stored as
-- old-format objects ({"book": ..., "chapters": ...}) instead of the current
-- plain-string-array format. Since get_all_todays_readings looks up readings
-- via `scheduled_date = CURRENT_DATE`, any group on one of these plans has a
-- permanently empty Today screen already -- deleting the plan cannot make
-- that worse. They're superseded by the plan_templates catalog (see
-- 20260919_add_plan_templates.sql / TODOS.md Phase 3).
--
-- This migration is applied manually via the Supabase SQL Editor per this
-- repo's workflow, so it aborts loudly instead of guessing if the plan set
-- doesn't match exactly what was found during Phase 3 investigation.
--
-- First run (2026-09-19) found exactly 1 group still on one of these plans
-- and aborted rather than delete underneath it. Confirmed by the app owner
-- (2026-09-20) that group was their own test group for this feature, not a
-- real user, so this run deletes that group (and its dependent
-- group_members/reading_completions rows) along with the stale plans. The
-- group-count check below still guards against deleting more than the one
-- confirmed group if the data has changed since.

DO $$
DECLARE
  stale_plan_ids UUID[];
  affected_group_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(id) INTO stale_plan_ids
  FROM reading_plans
  WHERE is_public = true
    AND created_at::date = '2026-02-14'
    AND name IN (
      '30-Day Psalms',
      '7-Day Gospels Sampler',
      '90-Day New Testament',
      'One Year Bible'
    );

  IF COALESCE(array_length(stale_plan_ids, 1), 0) <> 4 THEN
    RAISE EXCEPTION
      'Expected exactly 4 stale seed plans (30-Day Psalms, 7-Day Gospels Sampler, 90-Day New Testament, One Year Bible) dated 2026-02-14, found %. Aborting -- verify the current data manually before deleting.',
      COALESCE(array_length(stale_plan_ids, 1), 0);
  END IF;

  SELECT ARRAY_AGG(id) INTO affected_group_ids
  FROM groups
  WHERE reading_plan_id = ANY(stale_plan_ids);

  IF COALESCE(array_length(affected_group_ids, 1), 0) > 1 THEN
    RAISE EXCEPTION
      'Aborting: % groups now reference these stale plans, but only 1 (a confirmed test group) was expected and approved for deletion. Re-investigate before re-running.',
      array_length(affected_group_ids, 1);
  END IF;

  IF affected_group_ids IS NOT NULL THEN
    DELETE FROM reading_completions WHERE group_id = ANY(affected_group_ids);
    DELETE FROM group_members WHERE group_id = ANY(affected_group_ids);
    DELETE FROM groups WHERE id = ANY(affected_group_ids);
    RAISE NOTICE 'Deleted % test group(s) and their dependent rows.', array_length(affected_group_ids, 1);
  END IF;

  DELETE FROM plan_readings WHERE plan_id = ANY(stale_plan_ids);
  DELETE FROM reading_plans WHERE id = ANY(stale_plan_ids);

  RAISE NOTICE 'Deleted % stale seed reading plans and their plan_readings rows.', array_length(stale_plan_ids, 1);
END $$;
