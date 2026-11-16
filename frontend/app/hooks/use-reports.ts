"use client";

import { useApiQuery } from "./use-api-query";

export type AccountReport = { id: string; hiddenByReports: boolean; removedAt: string | null; removalReason: string | null; reportCount: number; reasons: string[]; canDispute: boolean; photos: { id: string; description: string }[]; disputes: { id: string; status: string; explanation: string; decisionReason: string | null }[] };
export type ModerationReport = { id: string; ownerId: string | null; username: string | null; hiddenByReports: boolean; removedAt: string | null; removalReason: string | null; reportCount: number; reports: { reporterId: string; reason: string; details: string; createdAt: string }[]; photos: { id: string; description: string }[]; disputes: { id: string; explanation: string; status: string; decisionReason: string | null }[] };

export function useAccountReports(page: number, postId: string | null) {
  const filter = postId ? '&postId=' + encodeURIComponent(postId) : '';
  return useApiQuery<AccountReport[]>('/api/account/reports?page=' + page + filter, { authenticated: true });
}

export function useModerationReports(page: number) {
  return useApiQuery<ModerationReport[]>('/api/moderation/reports?page=' + page, { authenticated: true });
}

type CommentReport = { id: string; postId: string; authorId: string; authorUsername: string; body: string; hiddenByReports: boolean; reportCount: number };

export function useCommentReports(page: number) {
  return useApiQuery<CommentReport[]>('/api/moderation/reported-comments?page=' + page, { authenticated: true });
}
