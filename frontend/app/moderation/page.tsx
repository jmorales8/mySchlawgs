"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { api } from "../components/api";
import { useModerationReports, useCommentReports } from "../hooks/use-reports";
import { useAccount } from "../contexts/account-context";
import PostModeration from "../components/community/moderation/post-moderation";
import DisputeForm from "../components/community/moderation/dispute-form";
import sharedStyles from "../components/community/community.module.css";
import styles from "./page.module.css";
import AccountBan from "./account-ban";
import PromptIdeas from "../components/community/prompts/prompt-ideas";

function ReviewButton({ path, label, onSaved }: { path: string; label: string; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function review() {
    setBusy(true);
    setError("");
    try {
      await api(path, { method: "POST" });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" disabled={busy} onClick={() => void review()}>{busy ? "Saving…" : label}</button>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </>;
}

export default function ModerationPage() {
  const [page, setPage] = useState(0);
  const [commentPage, setCommentPage] = useState(0);
  const { user } = useAccount();
  const userId = user?.id ?? null;
  const { data: entries = [], loading, error, refresh } = useModerationReports(page);
  const comments = useCommentReports(commentPage);
  return <main className={sharedStyles.shell}><nav className={sharedStyles.nav}><Link href="/">← Back to community</Link></nav><div style={{ maxWidth: 900, margin: "auto", padding: 24 }}>
    <h1>Moderation queue</h1><p>Posts and comments are hidden from the community after three distinct reports.</p>
    {user?.isAdmin && <AccountBan />}
    {user && (user.isAdmin || user.isModerator) && <PromptIdeas key={user.id} isAdmin={user.isAdmin} />}
    {loading && <p role="status">Loading reports…</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    {!loading && !error && <>
      {entries.length === 0 && <p>No reports on this page.</p>}
      {entries.map(entry => <article className={sharedStyles.card} key={entry.id}>
        <h2>@{entry.username ?? "unknown"} · {entry.reportCount} reports</h2>
        <p>{entry.removedAt ? `Removed: ${entry.removalReason}` : entry.hiddenByReports ? "Hidden from the community · Awaiting review" : "Still visible to the community"}</p>
        <details><summary>View photos and report details</summary>
          {entry.photos.map(photo => <figure key={photo.id}><img src={`/api/moderation/photos/${photo.id}`} alt="Reported post photo" loading="lazy" style={{ maxWidth: "100%", maxHeight: 400, objectFit: "contain" }} /><figcaption>{photo.description}</figcaption></figure>)}
          <ul>{entry.reports.map(report => <li key={report.reporterId}>
            <strong>{report.reason}</strong> · {new Date(report.createdAt).toLocaleString()}
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{report.details}</p>
            {entry.ownerId !== userId && <ReviewButton path={`/api/moderation/posts/${entry.id}/reports/${report.reporterId}/dismiss`} label="Remove report" onSaved={refresh} />}
          </li>)}</ul>
        </details>
        {!entry.removedAt && entry.ownerId !== userId && <>
          {entry.reportCount > 0 || entry.hiddenByReports ? <ReviewButton path={`/api/moderation/posts/${entry.id}/restore`} label={entry.hiddenByReports ? "Restore post" : "Dismiss post reports"} onSaved={refresh} /> : null}
          <PostModeration postId={entry.id} userId={userId} canReport={false} canModerate reported={false} onRemoved={refresh} />
        </>}
        {entry.disputes.map(dispute => <section key={dispute.id}><h3>Author dispute · {dispute.status}</h3><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{dispute.explanation}</p>{dispute.decisionReason && <p>{dispute.decisionReason}</p>}{dispute.status === "pending" && <DisputeForm id={dispute.id} review onSaved={refresh} />}</section>)}
      </article>)}
      <button disabled={page === 0} onClick={() => { setPage(page - 1); }}>Previous</button> <span>Page {page + 1}</span> <button disabled={entries.length < 20} onClick={() => { setPage(page + 1); }}>Next</button>
    </>}
    <section aria-label="Reported comments">
      <h2>Reported comments</h2>
      {comments.loading && <p role="status">Loading reported comments…</p>}
      {comments.error && <p className={styles.error} role="alert">{comments.error}</p>}
      {!comments.loading && !comments.error && <>
        {!comments.data?.length && <p>No reported comments on this page.</p>}
        {comments.data?.map(report => <article className={sharedStyles.card} key={report.id}>
          <h3>@{report.authorUsername}</h3>
          <blockquote style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{report.body}</blockquote>
          <p>{report.reportCount} {report.reportCount === 1 ? "report" : "reports"} · {report.hiddenByReports ? "Hidden from the community" : "Still visible to the community"}</p>
          <Link href={`/posts/${report.postId}`}>View original post</Link>
          {report.authorId !== userId && <div>
            <ReviewButton path={`/api/moderation/comments/${report.id}/restore`} label={report.hiddenByReports ? "Restore comment" : "Dismiss comment reports"} onSaved={comments.refresh} />{" "}
            <ReviewButton path={`/api/moderation/comments/${report.id}/remove`} label="Remove comment" onSaved={comments.refresh} />
          </div>}
        </article>)}
        <button disabled={commentPage === 0} onClick={() => setCommentPage(commentPage - 1)}>Previous comments page</button>{" "}
        <span>Page {commentPage + 1}</span>{" "}
        <button disabled={(comments.data?.length ?? 0) < 20} onClick={() => setCommentPage(commentPage + 1)}>Next comments page</button>
      </>}
    </section>
  </div></main>;
}
