-- Add group_is_personal passthrough column so TodayReading.group matches
-- the full Group type (is_personal). Purely additive — the security-relevant
-- WHERE clause from the IDOR fix (20260718_fix_get_all_todays_readings_idor)
-- is untouched.
CREATE OR REPLACE FUNCTION get_all_todays_readings(
  user_uuid uuid,
  p_date    date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  group_id              uuid,
  group_name            text,
  group_reading_plan_id uuid,
  group_start_date      date,
  group_invite_code     text,
  group_is_personal     boolean,
  group_created_by      uuid,
  group_created_at      timestamptz,
  group_updated_at      timestamptz,
  plan_name             text,
  plan_total_days       integer,
  plan_is_public        boolean,
  plan_created_by       uuid,
  plan_created_at       timestamptz,
  day_number            integer,
  passages              jsonb,
  completed             boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    g.id                AS group_id,
    g.name              AS group_name,
    g.reading_plan_id   AS group_reading_plan_id,
    g.start_date        AS group_start_date,
    g.invite_code       AS group_invite_code,
    g.is_personal       AS group_is_personal,
    g.created_by        AS group_created_by,
    g.created_at        AS group_created_at,
    g.updated_at        AS group_updated_at,
    rp.name             AS plan_name,
    rp.total_days       AS plan_total_days,
    rp.is_public        AS plan_is_public,
    rp.created_by       AS plan_created_by,
    rp.created_at       AS plan_created_at,
    pr.day_number,
    pr.passages,
    EXISTS (
      SELECT 1
      FROM   reading_completions rc
      WHERE  rc.user_id      = user_uuid
        AND  rc.group_id     = g.id
        AND  rc.reading_date = p_date
    )                   AS completed
  FROM  group_members gm
  JOIN  groups        g  ON  g.id              = gm.group_id
  JOIN  reading_plans rp ON  rp.id             = g.reading_plan_id
  LEFT JOIN plan_readings pr
    ON  pr.plan_id        = g.reading_plan_id
    AND pr.scheduled_date = p_date
  WHERE gm.user_id   = user_uuid
    AND gm.is_active = true
    AND (user_uuid = auth.uid() OR auth.role() = 'service_role');
$$;
