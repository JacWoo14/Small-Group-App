import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  getUserGroups,
  getGroupDetails,
  getAvailablePlans,
  createGroup,
  joinGroup,
  leaveGroup,
  changeGroupPlan,
  transferGroupOwnership,
} from '../services/groups';
import { getTodaysReadings, markComplete } from '../services/completions';
import { importReadingPlan, ParsedReading } from '../services/plans';

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
  const { user } = useAuth();

  return useQuery({
    queryKey: ['readingPlans', user?.id],
    queryFn: () => getAvailablePlans(user!.id),
    enabled: !!user,
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
      queryClient.invalidateQueries({ queryKey: ['streak', user?.id] });
    },
  });
}

export function useImportPlan() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (params: { name: string; readings: ParsedReading[] }) =>
      importReadingPlan(params.name, params.readings, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['readingPlans', user?.id] });
    },
  });
}

export function useChangeGroupPlan(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newPlanId: string) => changeGroupPlan(groupId, newPlanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['todaysReadings'] });
    },
  });
}

export function useTransferGroupOwnership(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newOwnerId: string) => transferGroupOwnership(groupId, newOwnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    },
  });
}
