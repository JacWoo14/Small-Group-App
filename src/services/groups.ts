import { supabase } from './supabase';
import { generateInviteCode } from '../utils/invite';
import { Group, ReadingPlan, GroupMemberDetails } from '../types';
import { format } from 'date-fns';

/**
 * Create a new group with a reading plan
 * Generates invite code and adds creator as first member
 */
export async function createGroup(
  name: string,
  readingPlanId: string,
  startDate: string, // YYYY-MM-DD
  userId: string
): Promise<Group> {
  const inviteCode = generateInviteCode();

  // Use RPC to create group + add member atomically (avoids RLS timing issues)
  const { data: groupId, error } = await supabase
    .rpc('create_group_with_member', {
      group_name: name,
      plan_id: readingPlanId,
      group_start_date: startDate,
      invite: inviteCode,
      creator_id: userId,
    });

  if (error) throw error;

  // Fetch full group details (user is now a member, RLS allows it)
  const group = await getGroupDetails(groupId);
  if (!group) throw new Error('Failed to load created group');
  return group;
}

/**
 * Join a group by invite code
 * Uses an RPC function to bypass RLS (user can't SELECT group they're not in yet)
 */
export async function joinGroup(inviteCode: string, userId: string): Promise<Group> {
  // Use RPC to find and join group (bypasses RLS)
  const { data, error } = await supabase
    .rpc('join_group_by_code', {
      code: inviteCode.toUpperCase().trim(),
      joining_user_id: userId,
    });

  if (error) throw error;
  if (!data) throw new Error('Invalid invite code');

  // Now fetch the full group details (user is a member, so RLS allows it)
  const group = await getGroupDetails(data);
  if (!group) throw new Error('Failed to load group');
  return group;
}

/**
 * Get all groups the user is an active member of
 */
export async function getUserGroups(userId: string): Promise<Group[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      group:groups(
        *,
        reading_plan:reading_plans(*)
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) throw error;

  // Flatten: each row has { group: {...} }
  return (data || [])
    .map((row: any) => row.group)
    .filter(Boolean);
}

/**
 * Get group details with members and their completion status for today
 */
export async function getGroupDetails(groupId: string): Promise<Group | null> {
  const { data: group, error } = await supabase
    .from('groups')
    .select(`
      *,
      reading_plan:reading_plans(*)
    `)
    .eq('id', groupId)
    .single();

  if (error) throw error;
  if (!group) return null;

  // Get members with today's completion status
  const today = format(new Date(), 'yyyy-MM-dd');
  const members = await getGroupMembers(groupId, today);
  group.members = members;

  return group;
}

/**
 * Get group members with completion status for a given date
 */
export async function getGroupMembers(
  groupId: string,
  date: string
): Promise<GroupMemberDetails[]> {
  // Get active members
  const { data: members, error: membersError } = await supabase
    .from('group_members')
    .select(`
      group_id,
      user_id,
      joined_at,
      is_active,
      user:users(display_name, email)
    `)
    .eq('group_id', groupId)
    .eq('is_active', true);

  if (membersError) throw membersError;

  // Get completions for this date
  const { data: completions, error: compError } = await supabase
    .from('reading_completions')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('reading_date', date);

  if (compError) throw compError;

  const completedUserIds = new Set((completions || []).map((c: any) => c.user_id));

  return (members || []).map((m: any) => ({
    group_id: m.group_id,
    user_id: m.user_id,
    joined_at: m.joined_at,
    is_active: m.is_active,
    display_name: m.user?.display_name || 'Unknown',
    email: m.user?.email || '',
    completed_today: completedUserIds.has(m.user_id),
  }));
}

/**
 * Leave a group (soft delete)
 */
export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ is_active: false })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Get all public reading plans plus plans created by the current user
 */
export async function getAvailablePlans(userId: string): Promise<ReadingPlan[]> {
  const { data, error } = await supabase
    .from('reading_plans')
    .select('*')
    .or(`is_public.eq.true,created_by.eq.${userId}`)
    .order('name');

  if (error) throw error;
  return data || [];
}

/**
 * Transfer group ownership to another member (creator only — enforced by RLS).
 * The new owner must be an active member of the group.
 */
export async function transferGroupOwnership(
  groupId: string,
  newOwnerId: string
): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .update({ created_by: newOwnerId })
    .eq('id', groupId);

  if (error) throw error;
}

/**
 * Change a group's reading plan (creator only — enforced by RLS)
 */
export async function changeGroupPlan(groupId: string, newPlanId: string): Promise<void> {
  const { data, error } = await supabase
    .from('groups')
    .update({ reading_plan_id: newPlanId })
    .eq('id', groupId)
    .select('id');

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('Update blocked — you may not have permission to change this group\'s plan.');
  }
}
