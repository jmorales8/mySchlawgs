"use client";
/* eslint-disable @next/next/no-img-element */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAccountReports } from "../../hooks/use-reports";
import DisputeForm from "../../components/community/dispute-form";
import styles from "../../components/community/community.module.css";
export default function ReportsPage() {
  return <Suspense fallback={<p role="status">Loading reports…</p>}><ReportsContent /></Suspense>;
}

function ReportsContent() {
  const [page, setPage] = useState(0);
  const searchParams = useSearchParams();
  const { data: entries, loading, error, refresh } = useAccountReports(page, searchParams.get("post"));
  return <main className={styles.shell}><nav className={styles.nav}><Link href="/">← Community</Link><Link href="/notifications">Notifications</Link></nav><section style={{ maxWidth: 850, padding: 24, margin: "auto" }}>
    <h1>Your reports & disputes</h1><Link href="/account/reports">All your reports</Link><p>Reporters stay anonymous. A dispute asks a moderator to reconsider; it does not automatically restore a removed post.</p>
    {error && <p role="alert">{error} <Link href="/#account">Account</Link></p>}{loading && !error && <p>Loading…</p>}
    {entries?.length === 0 && <p>No reports or disputes on this page.</p>}
    {entries?.map(entry => <article className={styles.card} key={entry.id}>
      <h2>{entry.removedAt ? "Post taken down" : entry.reportCount > 0 ? "Awaiting moderator review" : "Published post"} · {entry.reportCount} active reports</h2>
      <p role="status">{entry.removedAt ? "This post has been removed from public feeds and My photos. You can still view its report history and request a review here." : entry.reportCount > 0 ? "This post is hidden from public feeds while awaiting moderator review. Don’t worry—you can still see it in My photos." : "The reports have been dismissed. Your post is visible to the community again."}</p>
      <p>{entry.reasons.join(", ")}</p>{entry.removalReason && <p>Removal reason: {entry.removalReason}</p>}
      <details><summary>View your photos</summary>{entry.photos.map(photo => <figure key={photo.id}><img src={`/api/account/reports/photos/${photo.id}`} alt="Your reported photo" style={{ maxWidth: "100%", maxHeight: 300, objectFit: "contain" }} /><figcaption>{photo.description}</figcaption></figure>)}</details>
      {!entry.removedAt && <Link href={`/posts/${entry.id}`}>Open post</Link>}
      {entry.disputes.map(dispute => <div key={dispute.id}><h3>Dispute: {dispute.status}</h3><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{dispute.explanation}</p>{dispute.decisionReason && <p>Moderator decision: {dispute.decisionReason}</p>}</div>)}
      {entry.canDispute && <DisputeForm id={entry.id} onSaved={refresh} />}
    </article>)}
    {entries && <><button disabled={page === 0} onClick={() => { setPage(page - 1); }}>Previous</button> <span>Page {page + 1}</span> <button disabled={entries.length < 20} onClick={() => { setPage(page + 1); }}>Next</button></>}
  </section></main>;
}

