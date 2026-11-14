"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useModerationReports, useRemovedCommentReports } from "../hooks/use-reports";
import { useAccount } from "../contexts/account-context";
import PostModeration from "../components/community/moderation/post-moderation";
import DisputeForm from "../components/community/moderation/dispute-form";
import sharedStyles from "../components/community/community.module.css";
import styles from "./page.module.css";

export default function ModerationPage() {
  const [page, setPage] = useState(0);
  const [commentPage, setCommentPage] = useState(0);
  const { user } = useAccount();
  const userId = user?.id ?? null;
  const { data: entries = [], loading, error, refresh } = useModerationReports(page);
  const comments = useRemovedCommentReports(commentPage);
  return <main className={sharedStyles.shell}><nav className={sharedStyles.nav}><Link href="/">← Back to community</Link></nav><div style={{ maxWidth: 900, margin: "auto", padding: 24 }}>
    <h1>Moderation queue</h1><p>Review reported posts. Reported posts are hidden from public feeds while awaiting review.</p>
    {loading && <p role="status">Loading reports…</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    {!loading && !error && <>
      {entries.length === 0 && <p>No reports on this page.</p>}
      {entries.map(entry => <article className={sharedStyles.card} key={entry.id}>
        <h2>@{entry.username ?? "unknown"} · {entry.reportCount} reports</h2>
        <p>{entry.removedAt ? `Removed: ${entry.removalReason}` : "Hidden from public feeds · Awaiting review"}</p>
        <details><summary>View photos and report details</summary>
          {entry.photos.map(photo => <figure key={photo.id}><img src={`/api/moderation/photos/${photo.id}`} alt="Reported post photo" loading="lazy" style={{ maxWidth: "100%", maxHeight: 400, objectFit: "contain" }} /><figcaption>{photo.description}</figcaption></figure>)}
          <ul>{entry.reports.map((report, index) => <li key={index}><strong>{report.reason}</strong> · {new Date(report.createdAt).toLocaleString()}<p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{report.details}</p></li>)}</ul>
        </details>
        {!entry.removedAt && <PostModeration postId={entry.id} userId={userId} canModerate reported={false} onRemoved={refresh} />}
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
          <p>Removed and reported by @{report.reporterUsername} · <time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString()}</time></p>
          <Link href={`/posts/${report.postId}`}>View original post</Link>
        </article>)}
        <button disabled={commentPage === 0} onClick={() => setCommentPage(commentPage - 1)}>Previous comments page</button>{" "}
        <span>Page {commentPage + 1}</span>{" "}
        <button disabled={(comments.data?.length ?? 0) < 20} onClick={() => setCommentPage(commentPage + 1)}>Next comments page</button>
      </>}
    </section>
  </div></main>;
}
