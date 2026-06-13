import { supabase } from './supabase';
import { ReadingPlan } from '../types';

export interface ParsedReading {
  passage: string;
  scheduled_date: string; // YYYY-MM-DD
}

/**
 * Parse pasted plan text into structured readings.
 * Supports tab-separated format: "Genesis 1\t3-16-2026"
 * Dates in M-D-YYYY format are normalized to YYYY-MM-DD.
 * Returns null if any line is malformed or has an invalid calendar date.
 *
 * Returns { readings, hasExplicitDates: false } sentinel when no dates are
 * detected (all lines are single-column) — caller should handle dateless mode.
 */
export function parsePlanText(text: string): ParsedReading[] | null {
  const lines = text
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const results: ParsedReading[] = [];

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 2) return null; // All lines must have a date

    const passage = parts[0].trim();
    const rawDate = parts[1].trim();
    const scheduled_date = normalizeDateString(rawDate);

    if (!scheduled_date) return null; // Unparseable date

    results.push({ passage, scheduled_date });
  }

  return results;
}

function normalizeDateString(raw: string): string | null {
  let normalized: string;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    normalized = raw;
  } else {
    // Handles "3-16-2026" or "03-16-2026" → "2026-03-16"
    const match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (!match) return null;
    const [, m, d, y] = match;
    normalized = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Verify the date is a real calendar date (catches Feb 30, Apr 31, etc.)
  const parsed = new Date(normalized + 'T00:00:00');
  if (isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    return null;
  }

  return normalized;
}

/**
 * Detect whether pasted text has explicit dates (tab-separated) or is
 * dateless (one passage per line, no tab). Returns 'dated' | 'dateless' | 'mixed'.
 */
export function detectPlanFormat(text: string): 'dated' | 'dateless' | 'mixed' {
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return 'dateless';
  const hasTabs = lines.filter((l) => l.includes('\t'));
  if (hasTabs.length === lines.length) return 'dated';
  if (hasTabs.length === 0) return 'dateless';
  return 'mixed';
}

/**
 * Parse a dateless plan (one passage per line) with a provided start date.
 * Each reading is assigned a sequential date starting from startDate.
 */
export function parseDatelessPlanText(
  text: string,
  startDate: string // YYYY-MM-DD
): ParsedReading[] | null {
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const start = new Date(startDate + 'T00:00:00');
  if (isNaN(start.getTime())) return null;

  return lines.map((passage, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const scheduled_date = d.toISOString().slice(0, 10);
    return { passage, scheduled_date };
  });
}

/**
 * Import a reading plan into the database.
 * Creates a reading_plans row and N plan_readings rows with scheduled_date.
 */
export async function importReadingPlan(
  name: string,
  readings: ParsedReading[],
  createdBy: string
): Promise<ReadingPlan> {
  const { data: plan, error: planError } = await supabase
    .from('reading_plans')
    .insert({
      name: name.trim(),
      total_days: readings.length,
      is_public: false,
      created_by: createdBy,
    })
    .select()
    .single();

  if (planError) {
    if (planError.code === '23505') {
      const err: any = new Error(`You already have a plan named "${name.trim()}". Please use a different name.`);
      err.code = '23505';
      throw err;
    }
    throw planError;
  }

  const planReadings = readings.map((r) => ({
    plan_id: plan.id,
    scheduled_date: r.scheduled_date,
    passages: [r.passage],
  }));

  const { error: readingsError } = await supabase
    .from('plan_readings')
    .insert(planReadings);

  if (readingsError) {
    // Clean up the plan row if readings insert fails
    await supabase.from('reading_plans').delete().eq('id', plan.id);
    throw readingsError;
  }

  return plan;
}
