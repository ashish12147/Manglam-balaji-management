import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { useConnectivity } from '@/providers/ConnectivityProvider';

export function useApiQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>,
) {
  const { isOnline, isResolved } = useConnectivity();
  return useQuery({
    ...options,
    enabled: (options?.enabled ?? true) && (!isResolved || isOnline),
    queryFn,
    queryKey,
  });
}
