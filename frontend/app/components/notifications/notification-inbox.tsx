"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../api";
import styles from "./notification-inbox.module.css";
type Item = { id: string; postId: string; kind: string; message: string; createdAt: string; readAt: string | null; removed: boolean };
type Inbox = { unreadCount: number; reactionPeople: number; commentPeople: number; items: Item[] };
export default function NotificationInbox({ onUnreadChange, onNavigate }: { onUnreadChange?: (count: number) => void; onNavigate?: () => void }) {
  const [data, setData] = useState<Inbox | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() { try { const result = await api<Inbox>(`/api/notifications?page=${page}`); if (active) { setData(result); setError(""); } } catch (e) { if (active) setError((e as Error).message); } }
    void load(); const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [page]);
  useEffect(() => { if (data) onUnreadChange?.(data.unreadCount); }, [data, onUnreadChange]);
  async function mark(items: Item[]) {
    setBusy(true);
    try { for (const item of items.filter(n => !n.readAt)) await api(`/api/notifications/${item.id}/read`, { method: "PUT" }); setData(await api<Inbox>(`/api/notifications?page=${page}`)); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className={styles.inbox}>
    <h2>Notifications {data && <small>({data.unreadCount} unread)</small>}</h2>
    {error && <p role="alert" className={styles.error}>{error} <Link onClick={onNavigate} href="/#account">Account</Link></p>}
    {!data && !error && <p role="status">Loading notifications…</p>}
    {data && <><p>{data.reactionPeople} people have reacted and {data.commentPeople} people have commented on your currently published posts.</p>
      <button disabled={busy || !data.items.some(n => !n.readAt)} onClick={() => void mark(data.items)}>Mark this page as read</button>
      {data.items.length === 0 && <p>No notifications yet. New activity will appear here.</p>}
      {data.items.map(item => <article key={item.id} className={`${styles.card} ${item.readAt ? styles.read : styles.unread}`}>
        <p>{!item.readAt && <strong>New · </strong>}{item.message}</p><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
        <p>{["report", "removed", "dispute"].includes(item.kind) ? <Link onClick={onNavigate} href={`/account/reports?post=${item.postId}`}>View reports / dispute</Link> : item.removed ? "This post is no longer publicly available." : <Link onClick={onNavigate} href={`/posts/${item.postId}`}>View post</Link>}</p>
        {!item.readAt && <button disabled={busy} onClick={() => void mark([item])}>Mark as read</button>}
      </article>)}
      <button disabled={page === 0 || busy} onClick={() => { setData(null); setPage(page - 1); }}>Previous</button> <span>Page {page + 1}</span> <button disabled={data.items.length < 30 || busy} onClick={() => { setData(null); setPage(page + 1); }}>Next</button>
    </>}
  </section>;
}

