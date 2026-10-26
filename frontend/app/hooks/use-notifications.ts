"use client";

import { useApiQuery } from "./use-api-query";

export type NotificationItem = { id: string; postId: string; kind: string; message: string; createdAt: string; readAt: string | null; removed: boolean };
type Inbox = { unreadCount: number; reactionPeople: number; commentPeople: number; items: NotificationItem[] };

export function useNotifications(page = 0) {
  return useApiQuery<Inbox>(`/api/notifications?page=${page}`, {
    authenticated: true,
    refetchInterval: 30_000,
  });
}
