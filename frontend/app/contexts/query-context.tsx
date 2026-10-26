"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAccount } from "./account-context";
import { API_CHANGED } from "../lib/api-events";

export default function QueryProvider({ children }: { children: ReactNode }) {
  const { user } = useAccount();
  const accountId = user?.id ?? "guest";
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false } },
  }));

  // Keys isolate the next account immediately; removal also cancels requests
  // and prevents the previous account's cache from being reused on a later login.
  useEffect(() => () => {
    client.removeQueries({ queryKey: ["api", accountId] });
  }, [client, accountId]);

  useEffect(() => {
    const invalidate = () => { void client.invalidateQueries({ queryKey: ["api"] }); };
    window.addEventListener(API_CHANGED, invalidate);
    return () => {
      window.removeEventListener(API_CHANGED, invalidate);
    };
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
