"use client";

import { useApiQuery } from "./use-api-query";

export type AccountReport = { id: string; removedAt: string | null; removalReason: string | null; reportCount: number; reasons: string[]; canDispute: boolean; photos: { id: string; description: string }[]; disputes: { id: string; status: string; explanation: string; decisionReason: string | null }[] };
export type ModerationReport = { id: string; username: string | null; removedAt: string | null; removalReason: string | null; reportCount: number; reports: { reason: string; details: string; createdAt: string }[]; photos: { id: string; description: string }[]; disputes: { id: string; explanation: string; status: string; decisionReason: string | null }[] };

export function useAccountReports(page: number, postId: string | null) {
  const filter = postId ? '&postId=' + encodeURIComponent(postId) : '';
  return useApiQuery<AccountReport[]>('/api/account/reports?page=' + page + filter, { authenticated: true });
}

export function useModerationReports(page: number) {
  return useApiQuery<ModerationReport[]>('/api/moderation/reports?page=' + page, { authenticated: true });
}
