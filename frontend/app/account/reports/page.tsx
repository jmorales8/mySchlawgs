"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../components/api";
import DisputeForm from "../../components/community/dispute-form";
import styles from "../../components/community/community.module.css";
type Entry = { id: string; removedAt: string | null; removalReason: string | null; reportCount: number; reasons: string[]; canDispute: boolean; photos: { id: string; description: string }[]; disputes: { id: string; status: string; explanation: string; decisionReason: string | null }[] };
export default function ReportsPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  async function refresh() { setEntries(await api<Entry[]>(`/api/account/reports?page=${page}${new URLSearchParams(window.location.search).get("post") ? `&postId=${encodeURIComponent(new URLSearchParams(window.location.search).get("post")!)}` : ""}`)); }
  useEffect(() => { let active = true; api<Entry[]>(`/api/account/reports?page=${page}${new URLSearchParams(window.location.search).get("post") ? `&postId=${encodeURIComponent(new URLSearchParams(window.location.search).get("post")!)}` : ""}`).then(items => { if (active) setEntries(items); }).catch((e: Error) => { if (active) setError(e.message); }); return () => { active = false; }; }, [page]);
  return <main className={styles.shell}><nav className={styles.nav}><Link href="/">← Community</Link><Link href="/notifications">Notifications</Link></nav><section style={{ maxWidth: 850, padding: 24, margin: "auto" }}>
    <h1>Your reports & disputes</h1><Link href="/account/reports">All your reports</Link><p>Reporters stay anonymous. A dispute asks a moderator to reconsider; it does not automatically restore a removed post.</p>
    {error && <p role="alert">{error} <Link href="/#account">Account</Link></p>}{!entries && !error && <p>Loading…</p>}
    {entries?.length === 0 && <p>No reports or disputes on this page.</p>}
    {entries?.map(entry => <article className={styles.card} key={entry.id}>
      <h2>{entry.removedAt ? "Post taken down" : "Published post"} · {entry.reportCount} active reports</h2>
      <p>{entry.reasons.join(", ")}</p>{entry.removalReason && <p>Removal reason: {entry.removalReason}</p>}
      <details><summary>View your photos</summary>{entry.photos.map(photo => <figure key={photo.id}><img src={`/api/account/reports/photos/${photo.id}`} alt="Your reported photo" style={{ maxWidth: "100%", maxHeight: 300, objectFit: "contain" }} /><figcaption>{photo.description}</figcaption></figure>)}</details>
      {!entry.removedAt && <Link href={`/posts/${entry.id}`}>Open post</Link>}
      {entry.disputes.map(dispute => <div key={dispute.id}><h3>Dispute: {dispute.status}</h3><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{dispute.explanation}</p>{dispute.decisionReason && <p>Moderator decision: {dispute.decisionReason}</p>}</div>)}
      {entry.canDispute && <DisputeForm id={entry.id} onSaved={refresh} />}
    </article>)}
    {entries && <><button disabled={page === 0} onClick={() => { setEntries(null); setError(""); setPage(page - 1); }}>Previous</button> <span>Page {page + 1}</span> <button disabled={entries.length < 20} onClick={() => { setEntries(null); setError(""); setPage(page + 1); }}>Next</button></>}
  </section></main>;
}

