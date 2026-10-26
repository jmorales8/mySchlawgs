"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "../contexts/account-context";
import { api } from "../components/api";

type Options = {
  enabled?: boolean;
  authenticated?: boolean;
  refetchInterval?: number;
  staleTime?: number;
};

/** Account-scoped GET requests with cancellation, loading, errors, and refresh. */
export function useApiQuery<T>(path: string, {
  enabled = true, authenticated = false, refetchInterval, staleTime,
}: Options = {}) {
  const { user, ready } = useAccount();
  const needsLogin = ready && authenticated && !user;
  const query = useQuery({
    queryKey: ["api", user?.id ?? "guest", path],
    queryFn: ({ signal }) => api<T>(path, { signal }),
    enabled: ready && enabled && !needsLogin,
    refetchInterval,
    ...(staleTime === undefined ? {} : { staleTime }),
  });
  const { refetch } = query;
  const refresh = useCallback(async () => {
    if (ready && enabled && !needsLogin) await refetch();
  }, [ready, enabled, needsLogin, refetch]);

  return {
    // Hide stale records on authorization errors or a failed visibility refresh.
    data: needsLogin || query.isError ? undefined : query.data,
    loading: !ready || query.isLoading,
    error: needsLogin ? "Please log in to continue." : query.error?.message ?? "",
    refreshing: query.isFetching,
    refresh,
  };
}
