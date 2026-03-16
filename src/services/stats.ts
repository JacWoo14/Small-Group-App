import { supabase } from './supabase';
import { getGroupCompletionsForDate } from './completions';
import { StreakData, GroupRecap } from '../types';
import { format, subDays, differenceInCalendarDays, parseISO } from 'date-fns';

/**
 * Calculate a user's current and longest reading streak across all groups.
 * A streak day counts if the user completed ANY group's reading on that date.
 */
export async function getUserStreak(userId: string): Promise<StreakData> {
  const { data, error } = await supabase
    .from('reading_completions')
    .select('reading_date')
    .eq('user_id', userId)
    .order('reading_date', { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return { current: 0, longest: 0 };

  // Deduplicate dates (user may have multiple groups on one day)
  const uniqueDates = Array.from(
    new Set(data.map((r: any) => r.reading_date as string))
  ).sort((a, b) => b.localeCompare(a)); // descending

  // --- Current streak ---
  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  let current = 0;
  // Start from today if read today, otherwise from yesterday
  const startDate = uniqueDates[0] === today ? today : yesterday;

  if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
    let expected = startDate;
    for (const date of uniqueDates) {
      if (date === expected) {
        current++;
        expected = format(subDays(parseISO(expected), 1), 'yyyy-MM-dd');
      } else {
        break;
      }
    }
  }

  // --- Longest streak ---
  // Work with dates ascending for this calculation
  const ascending = [...uniqueDates].sort((a, b) => a.localeCompare(b));
  let longest = 0;
  let runLength = 1;

  for (let i = 1; i < ascending.length; i++) {
    const prev = parseISO(ascending[i - 1]);
    const curr = parseISO(ascending[i]);
    const diff = differenceInCalendarDays(curr, prev);

    if (diff === 1) {
      runLength++;
      if (runLength > longest) longest = runLength;
    } else {
      runLength = 1;
    }
  }
  // Handle single-entry edge case
  if (ascending.length === 1) longest = 1;
  if (current > longest) longest = current;

  return { current, longest };
}

/**
 * Get yesterday's recap for a group — who completed and who didn't.
 */
export async function getYesterdayGroupRecap(groupId: string): Promise<GroupRecap> {
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  // Get all active members
  const { data: members, error: membersError } = await supabase
    .from('group_members')
    .select('user_id, user:users(display_name)')
    .eq('group_id', groupId)
    .eq('is_active', true);

  if (membersError) throw membersError;

  // Get who completed yesterday
  const completions = await getGroupCompletionsForDate(groupId, yesterday);
  const completedIds = new Set(completions.map((c) => c.user_id));

  const allMembers = (members || []).map((m: any) => ({
    user_id: m.user_id,
    display_name: m.user?.display_name || 'Unknown',
    completed: completedIds.has(m.user_id),
  }));

  return {
    date: yesterday,
    total_members: allMembers.length,
    completions: allMembers,
  };
}
