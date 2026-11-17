"use client";

import { useState } from "react";
import { api } from "../components/api";
import PromptIdeaForm from "../components/community/prompts/prompt-idea-form";
import type { WeeklyPromptResponse } from "../components/community/prompts/weekly-prompt";
import sharedStyles from "../components/community/community.module.css";
import { useApiQuery } from "../hooks/use-api-query";
import styles from "./page.module.css";

type IdeaPage = {
  ideas: { id: string; text: string; username: string | null }[];
  hasMore: boolean;
};

export default function PromptIdeas({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(0);
  const [publishing, setPublishing] = useState<string>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const queue = useApiQuery<IdeaPage>(`/api/moderation/prompt-ideas?page=${page}`, { authenticated: true });
  const weekly = useApiQuery<WeeklyPromptResponse>("/api/weekly-prompt", { refetchInterval: 60_000 });
  const current = weekly.data?.prompt;

  async function publish(id: string) {
    setPublishing(id);
    setError("");
    setNotice("");
    try {
      await api(`/api/moderation/weekly-prompt/${id}`, { method: "PUT" });
      await weekly.refresh();
      setNotice("This week’s prompt was published.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setPublishing(undefined);
    }
  }

  return <section className={sharedStyles.card} aria-label="Add Yours prompt ideas">
    <h2>Add Yours prompt ideas</h2>
    <p>Admins choose one prompt to show in Feeling bored? each week. The week starts Monday in Central time.</p>
    {weekly.loading ? <p role="status">Loading the current prompt…</p> : weekly.error ? (
      <p className={styles.error} role="alert">{weekly.error} <button type="button" onClick={() => void weekly.refresh()}>Retry</button></p>
    ) : <p className={styles.promptText}><strong>This week’s prompt</strong><br />{current?.text ?? "No prompt selected."}</p>}
    <PromptIdeaForm staff />
    <h3>Submitted ideas</h3>
    {queue.loading && <p role="status">Loading ideas…</p>}
    {queue.error && <p className={styles.error} role="alert">{queue.error} <button type="button" onClick={() => void queue.refresh()}>Retry</button></p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {queue.data?.ideas.length === 0 && <p>No ideas on this page.</p>}
    {queue.data?.ideas.map(idea => <article className={styles.promptIdea} key={idea.id}>
      <p className={styles.promptText}>{idea.text}</p>
      <p className={sharedStyles.muted}>{idea.username ? `@${idea.username}` : "Former member"}</p>
      {current?.ideaId === idea.id ? <p>This week’s prompt</p> : isAdmin && (
        <button type="button" disabled={!!publishing || weekly.loading || !!weekly.error} onClick={() => void publish(idea.id)}>
          {publishing === idea.id ? "Publishing…" : current ? "Replace this week’s prompt" : "Publish for this week"}
        </button>
      )}
    </article>)}
    {(page > 0 || queue.data?.hasMore) && <div className={styles.promptPager}>
      <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page + 1}</span>
      <button type="button" disabled={!queue.data?.hasMore} onClick={() => setPage(page + 1)}>Next</button>
    </div>}
  </section>;
}
