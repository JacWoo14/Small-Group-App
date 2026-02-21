-- Bible Reading Accountability App - Database Schema
-- Optimized for Supabase PostgreSQL with RLS

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ^ Links to Supabase auth.users (important!)
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  timezone TEXT DEFAULT 'America/Chicago',
  preferred_notification_time TIME DEFAULT '07:00:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- READING PLANS TABLE
-- ============================================================================
CREATE TABLE reading_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  total_days INTEGER NOT NULL,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PLAN READINGS TABLE
-- ============================================================================
CREATE TABLE plan_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES reading_plans(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  passages JSONB NOT NULL,
  -- Example: [{"book": "Genesis", "chapters": "1-2"}, {"book": "Psalm", "chapter": "1"}]
  UNIQUE(plan_id, day_number)
);

-- ============================================================================
-- GROUPS TABLE
-- ============================================================================
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  reading_plan_id UUID REFERENCES reading_plans(id),
  start_date DATE NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- GROUP MEMBERS TABLE
-- ============================================================================
CREATE TABLE group_members (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true, -- For soft "leaving" groups
  PRIMARY KEY (group_id, user_id)
);

-- ============================================================================
-- READING COMPLETIONS TABLE (DATE-BASED!)
-- ============================================================================
CREATE TABLE reading_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL, -- Key change: date-based, not day-based
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(user_id, group_id, reading_date)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX idx_completions_group_date ON reading_completions(group_id, reading_date);
CREATE INDEX idx_completions_user_group ON reading_completions(user_id, group_id);
CREATE INDEX idx_completions_user_date ON reading_completions(user_id, reading_date);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_groups_invite_code ON groups(invite_code); -- For fast lookups

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_completions ENABLE ROW LEVEL SECURITY;

-- USERS: Users can only read/update their own record
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- READING PLANS: Public plans readable by all, private only by creator
CREATE POLICY "Public plans are viewable by everyone"
  ON reading_plans FOR SELECT
  USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Users can create plans"
  ON reading_plans FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- PLAN READINGS: Readable if plan is accessible
CREATE POLICY "Plan readings viewable if plan is accessible"
  ON plan_readings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reading_plans
      WHERE reading_plans.id = plan_readings.plan_id
      AND (reading_plans.is_public = true OR reading_plans.created_by = auth.uid())
    )
  );

-- GROUPS: Readable by members only
CREATE POLICY "Group members can view their groups"
  ON groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
      AND group_members.is_active = true
    )
  );

CREATE POLICY "Users can create groups"
  ON groups FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group creators can update their groups"
  ON groups FOR UPDATE
  USING (created_by = auth.uid());

-- GROUP MEMBERS: Members can see other members in their groups
CREATE POLICY "Group members can view group membership"
  ON group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
      AND gm.is_active = true
    )
  );

CREATE POLICY "Users can join groups"
  ON group_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave groups (soft delete)"
  ON group_members FOR UPDATE
  USING (user_id = auth.uid());

-- READING COMPLETIONS: Users can manage their own, view group members'
CREATE POLICY "Users can view completions in their groups"
  ON reading_completions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = reading_completions.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.is_active = true
    )
  );

CREATE POLICY "Users can create their own completions"
  ON reading_completions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own completions"
  ON reading_completions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own completions"
  ON reading_completions FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get today's reading for a group
CREATE OR REPLACE FUNCTION get_todays_reading(group_uuid UUID, user_timezone TEXT)
RETURNS TABLE (
  day_number INTEGER,
  passages JSONB
) AS $$
DECLARE
  group_start_date DATE;
  plan_total_days INTEGER;
  days_since_start INTEGER;
  day_in_plan INTEGER;
BEGIN
  -- Get group info
  SELECT g.start_date, rp.total_days
  INTO group_start_date, plan_total_days
  FROM groups g
  JOIN reading_plans rp ON g.reading_plan_id = rp.id
  WHERE g.id = group_uuid;

  -- Calculate days since start (in user's timezone)
  days_since_start := (CURRENT_DATE AT TIME ZONE user_timezone) - group_start_date;

  -- Handle plan cycling (day 366 of 365-day plan = day 1)
  day_in_plan := (days_since_start % plan_total_days) + 1;

  -- Return the reading
  RETURN QUERY
  SELECT pr.day_number, pr.passages
  FROM plan_readings pr
  WHERE pr.plan_id = (SELECT reading_plan_id FROM groups WHERE id = group_uuid)
  AND pr.day_number = day_in_plan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
