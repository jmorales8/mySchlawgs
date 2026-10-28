"use client";

import { useEffect, useRef, useState } from "react";

/** Compare against the start of this visit, so newly seen posts stay fresh until the next visit. */
export function useFeedCaughtUp(accountId: string, postIds: string[], enabled: boolean) {
  const signature = JSON.stringify([...new Set(postIds)].sort());
  const visit = useRef<{ accountId: string; seen: string[] | null } | null>(null);
  const [status, setStatus] = useState({ accountId: "", caughtUp: false });

  useEffect(() => {
    if (!enabled) return;
    const key = `myschlawgs:seen-feed:${accountId}`;
    if (visit.current?.accountId !== accountId) {
      let seen: string[] | null = null;
      try {
        const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
        if (Array.isArray(saved) && saved.every(id => typeof id === "string")) seen = saved;
      } catch { /* Browsing still works when storage is unavailable. */ }
      visit.current = { accountId, seen };
    }
    const ids: string[] = JSON.parse(signature);
    const previous = visit.current.seen;
    const caughtUp = previous !== null && ids.every(id => previous.includes(id));
    // Synchronize React with the previous visit stored in this browser tab.
    setStatus({ accountId, caughtUp });
    try { sessionStorage.setItem(key, signature); } catch { /* Storage can be disabled. */ }
  }, [accountId, signature, enabled]);

  return enabled && status.accountId === accountId && status.caughtUp;
}
