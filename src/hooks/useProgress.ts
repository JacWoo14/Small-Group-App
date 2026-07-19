import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getUserStreak, getYesterdayGroupRecap } from '../services/stats';

export function useUserStreak() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['streak', user?.id],
    queryFn: () => getUserStreak(user!.id, user!.timezone),
    enabled: !!user,
  });
}

export function useYesterdayRecap(groupId: string) {
  return useQuery({
    queryKey: ['recap', groupId],
    queryFn: () => getYesterdayGroupRecap(groupId),
    enabled: !!groupId,
  });
}
