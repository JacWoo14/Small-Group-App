-- Fixes to the days-behind count and rest-day handling.
-- Safe to run more than once.

-- 1. Remember when a group switches plans, so days before the switch (when the
--    group was reading something else) are not counted as behind.
ALTER TABLE groups ADD COLUMN IF NOT EXISTS plan_changed_at timestamptz;

CREATE OR REPLACE FUNCTION set_plan_changed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.plan_changed_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS groups_plan_changed ON groups;
CREATE TRIGGER groups_plan_changed
  BEFORE UPDATE OF reading_plan_id ON groups
  FOR EACH ROW
  WHEN (OLD.reading_plan_id IS DISTINCT FROM NEW.reading_plan_id)
  EXECUTE FUNCTION set_plan_changed_at();

-- 2. Rejoining a group starts a fresh join date, so time away is not counted.
CREATE OR REPLACE FUNCTION reset_joined_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.joined_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_members_rejoined ON group_members;
CREATE TRIGGER group_members_rejoined
  BEFORE UPDATE OF is_active ON group_members
  FOR EACH ROW
  WHEN (OLD.is_active = false AND NEW.is_active = true)
  EXECUTE FUNCTION reset_joined_at();

-- 3. Count distinct missed dates; use the user's local join and plan-change
--    dates; and only look back 30 days, the furthest the Today screen can mark
--    complete (PAST_DAYS_LIMIT in src/utils/dateNav.ts).
CREATE OR REPLACE FUNCTION get_days_behind(
  user_uuid uuid,
  p_date    date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  group_id    uuid,
  days_behind integer
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    g.id AS group_id,
    COUNT(DISTINCT pr.scheduled_date)::integer AS days_behind
  FROM  group_members gm
  JOIN  users         u  ON  u.id = gm.user_id
  CROSS JOIN LATERAL (
    -- An unknown timezone would raise, so fall back to UTC
    SELECT COALESCE(
      (SELECT name FROM pg_timezone_names WHERE name = u.timezone),
      'UTC'
    ) AS name
  ) tz
  JOIN  groups        g  ON  g.id = gm.group_id
  JOIN  plan_readings pr ON  pr.plan_id = g.reading_plan_id
  WHERE gm.user_id   = user_uuid
    AND gm.is_active = true
    AND pr.scheduled_date <  p_date
    AND pr.scheduled_date >= GREATEST(
      g.start_date,
      (gm.joined_at AT TIME ZONE tz.name)::date,
      (g.plan_changed_at AT TIME ZONE tz.name)::date, -- NULL is ignored
      p_date - 30
    )
    AND NOT EXISTS (
      SELECT 1
      FROM   reading_completions rc
      WHERE  rc.user_id      = user_uuid
        AND  rc.group_id     = g.id
        AND  rc.reading_date = pr.scheduled_date
    )
    AND (user_uuid = auth.uid() OR auth.role() = 'service_role')
  GROUP BY g.id;
$$;

-- 4. Whether a group's plan has a reading on a date. Lets the app skip the
--    recap for rest days; members who did not create the plan cannot read
--    plan_readings directly.
CREATE OR REPLACE FUNCTION group_has_reading(
  p_group_id uuid,
  p_date     date
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM  group_members gm
    JOIN  groups        g  ON g.id = gm.group_id
    JOIN  plan_readings pr ON pr.plan_id = g.reading_plan_id
    WHERE gm.group_id  = p_group_id
      AND gm.user_id   = auth.uid()
      AND gm.is_active = true
      AND pr.scheduled_date = p_date
  );
$$;
