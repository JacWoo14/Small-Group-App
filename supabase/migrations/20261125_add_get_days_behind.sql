-- Per-group count of scheduled reading days before p_date that the user has
-- not completed, used by send-daily-reminders to show "(N days behind)".
-- Only days since the later of the group's start_date and the user's join
-- date count, so new members don't start out "behind" on history that
-- predates them. Same access rule as get_all_todays_readings (IDOR fix):
-- callable for your own user id, or by the service role (the reminder cron).
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
    COUNT(pr.id)::integer AS days_behind
  FROM  group_members gm
  JOIN  groups        g  ON  g.id = gm.group_id
  JOIN  plan_readings pr ON  pr.plan_id = g.reading_plan_id
  WHERE gm.user_id   = user_uuid
    AND gm.is_active = true
    AND pr.scheduled_date <  p_date
    AND pr.scheduled_date >= GREATEST(g.start_date, gm.joined_at::date)
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
