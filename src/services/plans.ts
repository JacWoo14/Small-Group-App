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
  // Handles "3-16-2026" or "03-16-2026" → "2026-03-16"
  const parts = raw.split('-');
  if (parts.length === 3) {
    const [m, d, y] = parts;
    if (y.length === 4) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
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

  if (planError) throw planError;

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
