-- Dedupe plan_templates rows caused by re-running
-- 20260920_seed_plan_templates_catalog.sql more than once against
-- production. plan_templates.name has no unique constraint, so each run
-- blindly inserts a fresh set of rows rather than upserting -- any plan
-- present across multiple runs ends up with duplicate rows (each with its
-- own plan_template_readings, since content was identical across runs).
--
-- For each duplicated name, keeps the OLDEST row (earliest created_at) and
-- deletes the rest. plan_template_readings cascade-delete with their parent
-- (ON DELETE CASCADE per 20260919_add_plan_templates.sql), so no separate
-- cleanup is needed there.
--
-- Also adds a UNIQUE constraint on plan_templates.name so this can't happen
-- silently again if the seed file is ever re-run by mistake.

DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC, id ASC) AS rn
    FROM plan_templates
  ),
  removed AS (
    DELETE FROM plan_templates
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    RETURNING id
  )
  SELECT COUNT(*) INTO dup_count FROM removed;

  RAISE NOTICE 'Deleted % duplicate plan_templates row(s) (and their cascaded plan_template_readings).', dup_count;
END $$;

ALTER TABLE plan_templates ADD CONSTRAINT plan_templates_name_key UNIQUE (name);
