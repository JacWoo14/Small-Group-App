-- Seed Data: Starter Reading Plans
-- Run this after schema.sql

-- ============================================================================
-- PLAN 1: One Year Bible (365 days)
-- ============================================================================
DO $$
DECLARE
  plan_id UUID;
BEGIN
  -- Create the plan
  INSERT INTO reading_plans (name, description, total_days, is_public)
  VALUES (
    'One Year Bible',
    'Read through the entire Bible in one year with a mix of Old Testament, New Testament, Psalms, and Proverbs each day.',
    365,
    true
  )
  RETURNING id INTO plan_id;

  -- Sample readings (first 10 days - you'll need to complete all 365)
  INSERT INTO plan_readings (plan_id, day_number, passages) VALUES
  (plan_id, 1, '[
    {"book": "Genesis", "chapters": "1-2"},
    {"book": "Matthew", "chapter": "1"},
    {"book": "Psalm", "chapter": "1"}
  ]'::jsonb),
  (plan_id, 2, '[
    {"book": "Genesis", "chapters": "3-4"},
    {"book": "Matthew", "chapter": "2"},
    {"book": "Psalm", "chapter": "2"}
  ]'::jsonb),
  (plan_id, 3, '[
    {"book": "Genesis", "chapters": "5-6"},
    {"book": "Matthew", "chapter": "3"},
    {"book": "Psalm", "chapter": "3"}
  ]'::jsonb),
  (plan_id, 4, '[
    {"book": "Genesis", "chapters": "7-8"},
    {"book": "Matthew", "chapter": "4"},
    {"book": "Psalm", "chapter": "4"}
  ]'::jsonb),
  (plan_id, 5, '[
    {"book": "Genesis", "chapters": "9-11"},
    {"book": "Matthew", "chapter": "5"},
    {"book": "Psalm", "chapter": "5"}
  ]'::jsonb),
  (plan_id, 6, '[
    {"book": "Genesis", "chapters": "12-14"},
    {"book": "Matthew", "chapter": "6"},
    {"book": "Psalm", "chapter": "6"}
  ]'::jsonb),
  (plan_id, 7, '[
    {"book": "Genesis", "chapters": "15-17"},
    {"book": "Matthew", "chapter": "7"},
    {"book": "Psalm", "chapter": "7"}
  ]'::jsonb),
  (plan_id, 8, '[
    {"book": "Genesis", "chapters": "18-19"},
    {"book": "Matthew", "chapter": "8"},
    {"book": "Psalm", "chapter": "8"}
  ]'::jsonb),
  (plan_id, 9, '[
    {"book": "Genesis", "chapters": "20-22"},
    {"book": "Matthew", "chapter": "9"},
    {"book": "Psalm", "chapter": "9"}
  ]'::jsonb),
  (plan_id, 10, '[
    {"book": "Genesis", "chapters": "23-24"},
    {"book": "Matthew", "chapter": "10"},
    {"book": "Psalm", "chapter": "10"}
  ]'::jsonb);

  -- TODO: Add remaining 355 days
  -- You can use a script or external tool to generate the full year
END $$;

-- ============================================================================
-- PLAN 2: 30-Day Psalms (one Psalm per day)
-- ============================================================================
DO $$
DECLARE
  plan_id UUID;
  i INTEGER;
BEGIN
  INSERT INTO reading_plans (name, description, total_days, is_public)
  VALUES (
    '30-Day Psalms',
    'Read one Psalm per day for 30 days. Perfect for meditation and reflection.',
    30,
    true
  )
  RETURNING id INTO plan_id;

  -- Generate all 30 days dynamically
  FOR i IN 1..30 LOOP
    INSERT INTO plan_readings (plan_id, day_number, passages)
    VALUES (
      plan_id,
      i,
      json_build_array(
        json_build_object('book', 'Psalm', 'chapter', i::text)
      )::jsonb
    );
  END LOOP;
END $$;

-- ============================================================================
-- PLAN 3: 90-Day New Testament
-- ============================================================================
DO $$
DECLARE
  plan_id UUID;
BEGIN
  INSERT INTO reading_plans (name, description, total_days, is_public)
  VALUES (
    '90-Day New Testament',
    'Read through the New Testament in 90 days, approximately 3 chapters per day.',
    90,
    true
  )
  RETURNING id INTO plan_id;

  -- Sample readings (first 10 days - Matthew)
  INSERT INTO plan_readings (plan_id, day_number, passages) VALUES
  (plan_id, 1, '[{"book": "Matthew", "chapters": "1-3"}]'::jsonb),
  (plan_id, 2, '[{"book": "Matthew", "chapters": "4-6"}]'::jsonb),
  (plan_id, 3, '[{"book": "Matthew", "chapters": "7-9"}]'::jsonb),
  (plan_id, 4, '[{"book": "Matthew", "chapters": "10-12"}]'::jsonb),
  (plan_id, 5, '[{"book": "Matthew", "chapters": "13-15"}]'::jsonb),
  (plan_id, 6, '[{"book": "Matthew", "chapters": "16-18"}]'::jsonb),
  (plan_id, 7, '[{"book": "Matthew", "chapters": "19-21"}]'::jsonb),
  (plan_id, 8, '[{"book": "Matthew", "chapters": "22-24"}]'::jsonb),
  (plan_id, 9, '[{"book": "Matthew", "chapters": "25-26"}]'::jsonb),
  (plan_id, 10, '[{"book": "Matthew", "chapters": "27-28"}]'::jsonb);

  -- TODO: Add remaining 80 days (Mark, Luke, John, Acts, Epistles, Revelation)
END $$;

-- ============================================================================
-- PLAN 4: 7-Day Gospels Sampler (for testing)
-- ============================================================================
DO $$
DECLARE
  plan_id UUID;
BEGIN
  INSERT INTO reading_plans (name, description, total_days, is_public)
  VALUES (
    '7-Day Gospels Sampler',
    'A week-long introduction to the life of Jesus through key Gospel passages.',
    7,
    true
  )
  RETURNING id INTO plan_id;

  INSERT INTO plan_readings (plan_id, day_number, passages) VALUES
  (plan_id, 1, '[{"book": "Luke", "chapters": "1-2", "note": "The Birth of Jesus"}]'::jsonb),
  (plan_id, 2, '[{"book": "Matthew", "chapters": "5-7", "note": "Sermon on the Mount"}]'::jsonb),
  (plan_id, 3, '[{"book": "John", "chapter": "3", "note": "Born Again"}]'::jsonb),
  (plan_id, 4, '[{"book": "Mark", "chapters": "4-5", "note": "Miracles of Jesus"}]'::jsonb),
  (plan_id, 5, '[{"book": "John", "chapters": "13-14", "note": "The Last Supper"}]'::jsonb),
  (plan_id, 6, '[{"book": "Matthew", "chapters": "26-27", "note": "The Crucifixion"}]'::jsonb),
  (plan_id, 7, '[{"book": "Luke", "chapter": "24", "note": "The Resurrection"}]'::jsonb);
END $$;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to verify plans were created:
SELECT
  rp.name,
  rp.total_days,
  COUNT(pr.id) as readings_count
FROM reading_plans rp
LEFT JOIN plan_readings pr ON rp.id = pr.plan_id
GROUP BY rp.id, rp.name, rp.total_days
ORDER BY rp.created_at;
