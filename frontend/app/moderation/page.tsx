"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../components/api";
import PostModeration from "../components/post-moderation";
import DisputeForm from "../components/dispute-form";
import styles from "../components/community.module.css";

type Entry = { id: string; username: string | null; removedAt: string | null; removalReason: string | null; reportCount: number; reports: { reason: string; details: string; createdAt: string }[]; photos: { id: string; description: string }[]; disputes: { id: string; explanation: string; status: string; decisionReason: string | null }[] };
export default function ModerationPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function refresh() { setEntries(await api<Entry[]>(`/api/moderation/reports?page=${page}`)); }
  useEffect(() => {
    let active = true;
    Promise.all([api<{ id: string }>("/api/auth/me"), api<Entry[]>(`/api/moderation/reports?page=${page}`)])
      .then(([user, posts]) => { if (active) { setUserId(user.id); setEntries(posts); } })
      .catch((e: Error) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page]);
  return <main className={styles.shell}><nav className={styles.nav}><Link href="/">← Back to community</Link></nav><div style={{ maxWidth: 900, margin: "auto", padding: 24 }}>
    <h1>Moderation queue</h1><p>Review reported posts. Posts with 11 distinct account reports are automatically taken down.</p>
    {loading && <p role="status">Loading reports…</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    {!loading && !error && <>
      {entries.length === 0 && <p>No reports on this page.</p>}
      {entries.map(entry => <article className={styles.card} key={entry.id}>
        <h2>@{entry.username ?? "unknown"} · {entry.reportCount} reports</h2>
        <p>{entry.removedAt ? `Removed: ${entry.removalReason}` : "Public · Awaiting review"}</p>
        {!entry.removedAt && <Link href={`/posts/${entry.id}`}>Open post</Link>}
        <details><summary>View photos and report details</summary>
          {entry.photos.map(photo => <figure key={photo.id}><img src={`/api/moderation/photos/${photo.id}`} alt="Reported post photo" loading="lazy" style={{ maxWidth: "100%", maxHeight: 400, objectFit: "contain" }} /><figcaption>{photo.description}</figcaption></figure>)}
          <ul>{entry.reports.map((report, index) => <li key={index}><strong>{report.reason}</strong> · {new Date(report.createdAt).toLocaleString()}<p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{report.details}</p></li>)}</ul>
        </details>
        {!entry.removedAt && <PostModeration postId={entry.id} userId={userId} canModerate reported={false} onRemoved={refresh} />}
        {entry.disputes.map(dispute => <section key={dispute.id}><h3>Author dispute · {dispute.status}</h3><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{dispute.explanation}</p>{dispute.decisionReason && <p>{dispute.decisionReason}</p>}{dispute.status === "pending" && <DisputeForm id={dispute.id} review onSaved={refresh} />}</section>)}
      </article>)}
      <button disabled={page === 0} onClick={() => { setLoading(true); setError(""); setPage(page - 1); }}>Previous</button> <span>Page {page + 1}</span> <button disabled={entries.length < 20} onClick={() => { setLoading(true); setError(""); setPage(page + 1); }}>Next</button>
    </>}
  </div></main>;
}
