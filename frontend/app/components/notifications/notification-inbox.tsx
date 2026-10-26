"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "../api";
import { useNotifications, type NotificationItem } from "../../hooks/use-notifications";
import styles from "./notification-inbox.module.css";
export default function NotificationInbox({ onNavigate }: { onNavigate?: () => void }) {
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const { data, loading, error: loadError, refresh } = useNotifications(page);
  const [writeError, setWriteError] = useState("");
  const error = writeError || loadError;
  async function mark(items: NotificationItem[]) {
    setBusy(true); setWriteError("");
    try { for (const item of items.filter(n => !n.readAt)) await api(`/api/notifications/${item.id}/read`, { method: "PUT" }); await refresh(); }
    catch (e) { setWriteError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className={styles.inbox}>
    <h2>Notifications {data && <small>({data.unreadCount} unread)</small>}</h2>
    {error && <p role="alert" className={styles.error}>{error} <Link onClick={onNavigate} href="/#account">Account</Link></p>}
    {loading && !error && <p role="status">Loading notifications…</p>}
    {data && <><p>{data.reactionPeople} people have reacted and {data.commentPeople} people have commented on your currently published posts.</p>
      <button disabled={busy || !data.items.some(n => !n.readAt)} onClick={() => void mark(data.items)}>Mark this page as read</button>
      {data.items.length === 0 && <p>No notifications yet. New activity will appear here.</p>}
      {data.items.map(item => <article key={item.id} className={`${styles.card} ${item.readAt ? styles.read : styles.unread}`}>
        <p>{!item.readAt && <strong>New · </strong>}{item.message}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
        <p>{["report", "removed", "dispute"].includes(item.kind) ? <Link onClick={onNavigate} href={`/account/reports?post=${item.postId}`}>View reports / dispute</Link> : item.removed ? "This post is no longer publicly available." : <Link onClick={onNavigate} href={`/posts/${item.postId}`}>View post</Link>}</p>
        {!item.readAt && <button disabled={busy} onClick={() => void mark([item])}>Mark as read</button>}
      </article>)}
      <button disabled={page === 0 || busy} onClick={() => { setPage(page - 1); }}>Previous</button> <span>Page {page + 1}</span> <button disabled={data.items.length < 30 || busy} onClick={() => { setPage(page + 1); }}>Next</button>
    </>}
  </section>;
}

