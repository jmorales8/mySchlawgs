"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { useModerationReports } from "../hooks/use-reports";
import { useAccount } from "../contexts/account-context";
import PostModeration from "../components/community/post-moderation";
import DisputeForm from "../components/community/dispute-form";
import styles from "../components/community/community.module.css";

export default function ModerationPage() {
  const [page, setPage] = useState(0);
  const { user } = useAccount();
  const userId = user?.id ?? null;
  const { data: entries = [], loading, error, refresh } = useModerationReports(page);
  return <main className={styles.shell}><nav className={styles.nav}><Link href="/">← Back to community</Link></nav><div style={{ maxWidth: 900, margin: "auto", padding: 24 }}>
    <h1>Moderation queue</h1><p>Review reported posts. Reported posts are hidden from public feeds while awaiting review.</p>
    {loading && <p role="status">Loading reports…</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    {!loading && !error && <>
      {entries.length === 0 && <p>No reports on this page.</p>}
      {entries.map(entry => <article className={styles.card} key={entry.id}>
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
  </div></main>;
}
