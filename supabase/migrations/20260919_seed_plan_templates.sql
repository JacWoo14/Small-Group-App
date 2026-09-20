-- Seeds the initial default plan template catalog (Phase 3).
--
-- Content is deliberately kept to single-book sequential-chapter plans —
-- chapter counts are simple, verifiable facts (John has 21 chapters,
-- Proverbs 31, Genesis 50) — plus one hand-picked 7-day sampler of
-- widely-known Gospel passages. This avoids asserting an inaccurate
-- day-by-day table for a specific named historical reading plan (e.g.
-- M'Cheyne's) without a properly sourced reference to check it against.

WITH t AS (
  INSERT INTO plan_templates (name, description, category, total_days)
  VALUES ('Gospel of John', 'Read through the Gospel of John, one chapter a day.', 'New Testament', 21)
  RETURNING id
)
INSERT INTO plan_template_readings (template_id, day_number, passages)
SELECT t.id, gs, jsonb_build_array('John ' || gs)
FROM t, generate_series(1, 21) AS gs;

WITH t AS (
  INSERT INTO plan_templates (name, description, category, total_days)
  VALUES ('Proverbs in a Month', 'One chapter of Proverbs each day — a classic devotional rhythm.', 'Wisdom', 31)
  RETURNING id
)
INSERT INTO plan_template_readings (template_id, day_number, passages)
SELECT t.id, gs, jsonb_build_array('Proverbs ' || gs)
FROM t, generate_series(1, 31) AS gs;

WITH t AS (
  INSERT INTO plan_templates (name, description, category, total_days)
  VALUES ('Psalms: The First 30', 'The first 30 Psalms, one per day — a gentle introduction to the Psalter.', 'Wisdom', 30)
  RETURNING id
)
INSERT INTO plan_template_readings (template_id, day_number, passages)
SELECT t.id, gs, jsonb_build_array('Psalm ' || gs)
FROM t, generate_series(1, 30) AS gs;

WITH t AS (
  INSERT INTO plan_templates (name, description, category, total_days)
  VALUES ('Genesis in 50 Days', 'Read through Genesis one chapter a day.', 'Old Testament', 50)
  RETURNING id
)
INSERT INTO plan_template_readings (template_id, day_number, passages)
SELECT t.id, gs, jsonb_build_array('Genesis ' || gs)
FROM t, generate_series(1, 50) AS gs;

WITH t AS (
  INSERT INTO plan_templates (name, description, category, total_days)
  VALUES ('7-Day Introduction to Jesus', 'A week-long sampler of key moments in the life of Jesus.', 'Sampler', 7)
  RETURNING id
)
INSERT INTO plan_template_readings (template_id, day_number, passages)
SELECT t.id, v.day_number, v.passages
FROM t, (VALUES
  (1, jsonb_build_array('Luke 2')),
  (2, jsonb_build_array('Matthew 5-7')),
  (3, jsonb_build_array('John 3')),
  (4, jsonb_build_array('Mark 4-5')),
  (5, jsonb_build_array('Luke 15')),
  (6, jsonb_build_array('John 13')),
  (7, jsonb_build_array('John 20'))
) AS v(day_number, passages);
