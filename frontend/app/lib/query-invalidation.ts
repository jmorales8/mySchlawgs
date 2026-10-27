export type RefreshMode = "refresh" | "stale" | "ignore";

/** Reactions change feed membership, but not photo records. Refresh those feeds
 * on their next visit/focus instead of refetching every visible post on a click. */
export function queryRefreshMode(queryPath: string, mutationPath: string): RefreshMode {
  if (/^\/api\/notifications(?:\/|$)/.test(mutationPath)) {
    return queryPath.startsWith("/api/notifications") ? "refresh" : "ignore";
  }
  if (/^\/api\/posts\/[^/]+\/(?:reaction|comments\/[^/]+\/(?:reaction|like))$/.test(mutationPath)) {
    if (queryPath.startsWith("/api/notifications")) return "refresh";
    if (/^\/api\/(?:photos|posts)(?:[/?]|$)/.test(queryPath)) return "stale";
    return "ignore";
  }
  // Uploads, edits, reports, moderation, and account changes retain immediate refresh.
  return "refresh";
}
import type { QueryClient } from "@tanstack/react-query";


export async function invalidateApiQueries(client: QueryClient, mutationPath: string) {
  const modeFor = (key: readonly unknown[]) => queryRefreshMode(String(key[2] ?? ""), mutationPath);
  await Promise.all([
    client.invalidateQueries({
      predicate: query => query.queryKey[0] === "api" && modeFor(query.queryKey) === "stale",
      refetchType: "none",
    }),
    client.invalidateQueries({
      predicate: query => query.queryKey[0] === "api" && modeFor(query.queryKey) === "refresh",
    }),
  ]);
}
