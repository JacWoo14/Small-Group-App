import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  getUserGroups,
  getGroupDetails,
  getAvailablePlans,
  createGroup,
  joinGroup,
  leaveGroup,
} from '../services/groups';
import { getTodaysReadings, markComplete } from '../services/completions';

export function useUserGroups() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['groups', user?.id],
    queryFn: () => getUserGroups(user!.id),
    enabled: !!user,
  });
}

export function useGroupDetails(groupId: string) {
  return useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroupDetails(groupId),
    enabled: !!groupId,
  });
}

export function useTodaysReadings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['todaysReadings', user?.id],
    queryFn: () => getTodaysReadings(user!.id, user!.timezone),
    enabled: !!user,
    refetchInterval: 60 * 1000, // Refresh every minute
  });
}

export function useAvailablePlans() {
  return useQuery({
    queryKey: ['readingPlans'],
    queryFn: getAvailablePlans,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (params: { name: string; readingPlanId: string; startDate: string }) =>
      createGroup(params.name, params.readingPlanId, params.startDate, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['todaysReadings', user?.id] });
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (inviteCode: string) => joinGroup(inviteCode, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['todaysReadings', user?.id] });
    },
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (groupId: string) => leaveGroup(groupId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['todaysReadings', user?.id] });
    },
  });
}

export function useMarkComplete() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (params: { groupId: string; readingDate: string }) =>
      markComplete(user!.id, params.groupId, params.readingDate),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['todaysReadings', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['group', variables.groupId] });
    },
  });
}
