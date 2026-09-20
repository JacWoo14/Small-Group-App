-- Built-in reading plan catalog ("default plans"). Templates are day-number
-- based (no scheduled_date) and are never referenced directly by
-- groups.reading_plan_id — a template is cloned into an ordinary
-- reading_plans + plan_readings row (see instantiateTemplate) with real
-- dates computed from whatever start date the group/individual picks. This
-- keeps get_all_todays_readings and its IDOR-hardened lookup untouched.

CREATE TABLE plan_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  total_days INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE plan_template_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES plan_templates(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  passages JSONB NOT NULL,
  UNIQUE(template_id, day_number)
);

CREATE INDEX idx_plan_template_readings_template ON plan_template_readings(template_id);

ALTER TABLE plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_template_readings ENABLE ROW LEVEL SECURITY;

-- Read-only catalog: any authenticated user can browse templates. There is
-- no INSERT/UPDATE/DELETE policy — content is curated directly via the
-- Supabase SQL Editor, consistent with this repo's other manually-managed
-- reference data.
CREATE POLICY "Authenticated users can view plan templates"
  ON plan_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view plan template readings"
  ON plan_template_readings FOR SELECT
  TO authenticated
  USING (true);
