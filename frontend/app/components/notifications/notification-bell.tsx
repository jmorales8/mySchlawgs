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
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const dialog = dialogRef.current!;
    const overflow = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = overflow; };
  }, []);
  useEffect(() => {
    if (!closing) return;
    const timeout = window.setTimeout(onClose, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
    return () => window.clearTimeout(timeout);
  }, [closing, onClose]);
  function close() {
    if (closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) onClose();
    else setClosing(true);
  }
  return <dialog ref={dialogRef} className={`${styles.modal}${closing ? ` ${styles.closing}` : ""}`} aria-label="Notifications" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className={styles.panel}>
      <header className={styles.header}><strong>Your activity</strong><button type="button" onClick={close} aria-label="Close notifications" autoFocus>✕</button></header>
      <NotificationInbox onNavigate={close} />
    </div>
  </dialog>;
}
