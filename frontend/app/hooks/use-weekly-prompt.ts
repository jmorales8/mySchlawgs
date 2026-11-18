"use client";

import { useApiQuery } from "./use-api-query";

type WeeklyPromptResponse = { prompt: { weekOf: string; ideaId: string; text: string } | null };

export function useWeeklyPrompt() {
  return useApiQuery<WeeklyPromptResponse>("/api/weekly-prompt", { refetchInterval: 60_000 });
}
