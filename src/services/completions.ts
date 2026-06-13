import { supabase } from './supabase';
import { TodayReading, ReadingCompletion } from '../types';

/**
 * Mark today's reading as complete for a group
 */
export async function markComplete(
  userId: string,
  groupId: string,
  readingDate: string // YYYY-MM-DD
): Promise<ReadingCompletion> {
  const { data, error } = await supabase
    .from('reading_completions')
    .insert({
      user_id: userId,
      group_id: groupId,
      reading_date: readingDate,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      // Unique constraint violation — already completed
      throw new Error('Already completed');
    }
    throw error;
  }

  return data;
}

/**
 * Get today's readings for all of the user's active groups.
 * Uses a single RPC call instead of N+1 queries.
 */
export async function getTodaysReadings(
  userId: string,
  _timezone: string
): Promise<TodayReading[]> {
  const { data, error } = await supabase
    .rpc('get_all_todays_readings', { user_uuid: userId });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  return (data as any[]).map((row) => ({
    group: {
      id: row.group_id,
      name: row.group_name,
      reading_plan_id: row.group_reading_plan_id,
      start_date: row.group_start_date,
      invite_code: row.group_invite_code,
      created_by: row.group_created_by,
      created_at: row.group_created_at,
      updated_at: row.group_updated_at,
      reading_plan: {
        id: row.group_reading_plan_id,
        name: row.plan_name,
        total_days: row.plan_total_days,
        is_public: row.plan_is_public,
        created_by: row.plan_created_by,
        description: null,
        created_at: '',
      },
    },
    day_number: row.day_number ?? null,
    passages: Array.isArray(row.passages) ? row.passages : (row.passages ?? []),
    completed: row.completed,
  }));
}

/**
 * Get completions for a group on a specific date
 */
export async function getGroupCompletionsForDate(
  groupId: string,
  date: string
) {
  const { data, error } = await supabase
    .from('reading_completions')
    .select(`
      user_id,
      completed_at,
      notes,
      user:users(display_name)
    `)
    .eq('group_id', groupId)
    .eq('reading_date', date);

  if (error) throw error;

  return (data || []).map((c: any) => ({
    user_id: c.user_id,
    display_name: c.user?.display_name || 'Unknown',
    completed: true,
    completed_at: c.completed_at,
    notes: c.notes,
  }));
}
