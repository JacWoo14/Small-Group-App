import { supabase } from './supabase';
import { getGroupCompletionsForDate } from './completions';
import { StreakData, GroupRecap } from '../types';
import { format, subDays, differenceInCalendarDays, parseISO } from 'date-fns';

/**
 * Pure function: given a list of completion date strings (YYYY-MM-DD, any order),
 * calculate current and longest streaks relative to a reference date.
 * Exported for testing.
 */
export function calculateStreakFromDates(
  dates: string[],
  today: string = format(new Date(), 'yyyy-MM-dd')
): StreakData {
  if (dates.length === 0) return { current: 0, longest: 0 };

  // Deduplicate and sort descending
  const uniqueDates = Array.from(new Set(dates)).sort((a, b) => b.localeCompare(a));

  const yesterday = format(subDays(parseISO(today), 1), 'yyyy-MM-dd');

  // --- Current streak ---
  let current = 0;
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
  const ascending = [...uniqueDates].sort((a, b) => a.localeCompare(b));
  let longest = 1; // At least 1 if there are any dates
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
  if (current > longest) longest = current;

  return { current, longest };
}

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

  const dates = data.map((r: any) => r.reading_date as string);
  return calculateStreakFromDates(dates);
}

/**
 * Get yesterday's recap for a group — who completed and who didn't.
 * Returns empty completions if the group was created today or yesterday
 * (not enough history to show a meaningful recap).
 */
export async function getYesterdayGroupRecap(groupId: string): Promise<GroupRecap> {
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  // Get group created_at to detect newly created groups
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('created_at')
    .eq('id', groupId)
    .single();

  if (groupError) throw groupError;

  // If the group was created on or after yesterday, there's no meaningful recap
  const groupCreatedDate = format(parseISO(group.created_at), 'yyyy-MM-dd');
  if (groupCreatedDate >= yesterday) {
    return { date: yesterday, total_members: 0, completions: [] };
  }

  // Get active members who joined before yesterday (new members excluded from recap)
  const { data: members, error: membersError } = await supabase
    .from('group_members')
    .select('user_id, joined_at, user:users(display_name)')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .lt('joined_at', yesterday + 'T00:00:00');

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
