"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "./api";
import NotificationInbox from "./notification-inbox";
import styles from "./notification-inbox.module.css";
export default function NotificationBell({ onOpen, onClose }: { onOpen: () => void; onClose: () => void }) {
  const [unread, setUnread] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const updateUnread = useCallback((count: number) => setUnread(count), []);
  useEffect(() => {
    let active = true;
    async function refresh() {
      if (document.visibilityState === "hidden" || open) return;
      try { const result = await api<{ unreadCount: number }>("/api/notifications"); if (active) setUnread(result.unreadCount); }
      catch { if (active) setUnread(null); }
    }
    void refresh(); const interval = setInterval(() => void refresh(), 30000);
    window.addEventListener("focus", refresh);
    return () => { active = false; clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [open]);
  function close() { setOpen(false); onClose(); }
  return <>
    <button type="button" className={styles.menuButton} aria-haspopup="dialog" onClick={() => { setOpen(true); onOpen(); }}>🔔 Notifications {unread !== null && unread > 0 && <strong className={styles.badge}>{unread > 99 ? "99+" : unread}<span className={styles.srOnly}> unread</span></strong>}</button>
    {open && createPortal(<NotificationModal onClose={close} onUnreadChange={updateUnread} />, document.body)}
  </>;
}
function NotificationModal({ onClose, onUnreadChange }: { onClose: () => void; onUnreadChange: (count: number) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current!;
    const overflow = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={dialogRef} className={styles.modal} aria-label="Notifications" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.panel}>
      <header className={styles.header}><strong>Your activity</strong><button type="button" onClick={onClose} aria-label="Close notifications" autoFocus>✕</button></header>
      <NotificationInbox onUnreadChange={onUnreadChange} onNavigate={onClose} />
    </div>
  </dialog>;
}
