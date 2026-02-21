import { supabase } from './supabase';
import { TodayReading, ReadingCompletion } from '../types';
import { format } from 'date-fns';

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
 * Get today's readings for all of the user's active groups
 */
export async function getTodaysReadings(
  userId: string,
  timezone: string
): Promise<TodayReading[]> {
  // Get user's active groups
  const { data: memberships, error: memError } = await supabase
    .from('group_members')
    .select(`
      group:groups(
        *,
        reading_plan:reading_plans(*)
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true);

  if (memError) throw memError;

  const groups = (memberships || [])
    .map((m: any) => m.group)
    .filter(Boolean);

  if (groups.length === 0) return [];

  const today = format(new Date(), 'yyyy-MM-dd');

  // Get today's reading and completion status for each group
  const readings: TodayReading[] = [];

  for (const group of groups) {
    // Call the SQL function to get today's reading
    const { data: readingData, error: readingError } = await supabase
      .rpc('get_todays_reading', {
        group_uuid: group.id,
        user_timezone: timezone,
      });

    if (readingError) {
      console.warn(`Failed to get reading for group ${group.id}:`, readingError);
      continue;
    }

    // Check if user completed today for this group
    const { data: completion } = await supabase
      .from('reading_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('group_id', group.id)
      .eq('reading_date', today)
      .maybeSingle();

    const reading = readingData?.[0];

    readings.push({
      group,
      day_number: reading?.day_number || 1,
      passages: reading?.passages || [],
      completed: !!completion,
    });
  }

  return readings;
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
