"use client";

import { useApiQuery } from "./use-api-query";
import type { Photo } from "../components/community/types";

export type Feed = "latest" | "interacted" | "mine";

export function usePhotoFeed(feed: Feed, postId?: string) {
  return useApiQuery<Photo[]>(postId ? `/api/posts/${postId}` : `/api/photos?feed=${feed}`, {
    authenticated: !postId && feed !== "latest",
    // Returning from discovery must check the server even within the usual cache window.
    ...(!postId && feed === "latest" ? { staleTime: 0 } : {}),
  });
}
