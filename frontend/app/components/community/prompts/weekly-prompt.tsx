"use client";

import { useAccount } from "../../../contexts/account-context";
import { useApiQuery } from "../../../hooks/use-api-query";
import PromptIdeaForm from "./prompt-idea-form";
import styles from "./prompts.module.css";

export type WeeklyPromptResponse = { prompt: { ideaId: string; text: string } | null };

export default function WeeklyPrompt({ enabled, onLogIn }: { enabled: boolean; onLogIn: () => void }) {
  const { user, ready } = useAccount();
  const { data, loading, error, refresh } = useApiQuery<WeeklyPromptResponse>("/api/weekly-prompt", { enabled, refetchInterval: 60_000 });

  return <section className={styles.weekly} aria-label="Add Yours">
    <h3>Add Yours</h3>
    {loading ? <p role="status">Loading this week’s prompt…</p> : error ? (
      <p className={styles.error} role="status">{error} <button type="button" onClick={() => void refresh()}>Retry</button></p>
    ) : data?.prompt ? (
      <p className={styles.prompt}><strong>This week’s prompt</strong>{data.prompt.text}</p>
    ) : <p>No prompt has been picked for this week yet.</p>}
    {user && !user.postingRestrictedAt && <PromptIdeaForm />}
    {ready && !user && <p><a href="#account" onClick={onLogIn}>Log in</a> to suggest a prompt.</p>}
  </section>;
}
