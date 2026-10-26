"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNotifications } from "../../hooks/use-notifications";
import NotificationInbox from "./notification-inbox";
import styles from "./notification-inbox.module.css";
export default function NotificationBell({ onOpen, onClose }: { onOpen: () => void; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const { data, error } = useNotifications();
  const unread = error ? null : data?.unreadCount ?? null;
  function close() { setOpen(false); onClose(); }
  return <>
    <button type="button" className={styles.menuButton} aria-haspopup="dialog" onClick={() => { setOpen(true); onOpen(); }}>🔔 Notifications {unread !== null && unread > 0 && <strong className={styles.badge}>{unread > 99 ? "99+" : unread}<span className={styles.srOnly}> unread</span></strong>}</button>
    {open && createPortal(<NotificationModal onClose={close} />, document.body)}
  </>;
}
function NotificationModal({ onClose }: { onClose: () => void }) {
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
      <NotificationInbox onNavigate={onClose} />
    </div>
  </dialog>;
}
