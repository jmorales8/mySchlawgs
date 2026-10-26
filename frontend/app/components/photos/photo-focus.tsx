"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./photo-focus.module.css";

type Photo = { id: string; downloadUrl: string; description: string; username: string | null };

export default function PhotoFocus({ photos, initialIndex, onClose }: { photos: Photo[]; initialIndex: number; onClose: (index: number) => void }) {
  const [index, setIndex] = useState(initialIndex);
  const [failed, setFailed] = useState(false);
  const [closing, setClosing] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const photo = photos[index];
  useEffect(() => {
    const dialog = dialogRef.current!;
    const focus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = overflow; if (focus?.isConnected) focus.focus(); };
  }, []);
  useEffect(() => {
    if (!closing) return;
    const timeout = window.setTimeout(() => onClose(index), 100);
    return () => window.clearTimeout(timeout);
  }, [closing, index, onClose]);
  function close() {
    if (closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { onClose(index); return; }
    setClosing(true);
  }
  function move(direction: number) { if (closing) return; setFailed(false); setIndex(value => (value + direction + photos.length) % photos.length); }
  return createPortal(<dialog ref={dialogRef} className={`${styles.dialog}${closing ? ` ${styles.closing}` : ""}`} aria-label="Photo focus viewer" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }} onKeyDown={event => {
    if (photos.length > 1 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) { event.preventDefault(); event.stopPropagation(); move(event.key === "ArrowLeft" ? -1 : 1); }
  }}>
    <div className={styles.viewer}>
      <header className={styles.header}><span>{photo.username ? `@${photo.username}` : "mySchlawgs"} · {index + 1} / {photos.length}</span><button type="button" onClick={close} aria-label="Close photo viewer">✕</button></header>
      <div className={styles.stage} onTouchStart={event => { const touch = event.touches[0]; touchStart.current = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null; }} onTouchEnd={event => {
        const start = touchStart.current; touchStart.current = null;
        if (!start || photos.length < 2) return;
        const touch = event.changedTouches[0]; const dx = touch.clientX - start.x; const dy = touch.clientY - start.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
      }}>
        {failed ? <p role="alert">This photo couldn’t load. Try reopening the viewer.</p> : <img key={photo.id} src={photo.downloadUrl} alt={photo.description || `Photo ${index + 1} by ${photo.username ?? "the community"}`} onError={() => setFailed(true)} />}
        {photos.length > 1 && <><button type="button" className={styles.previous} onClick={() => move(-1)} aria-label="Previous photo">‹</button><button type="button" className={styles.next} onClick={() => move(1)} aria-label="Next photo">›</button></>}
      </div>
      <footer className={styles.caption} aria-live="polite" aria-atomic="true"><span>Photo {index + 1} of {photos.length}</span>{photo.description && <p>{photo.description}</p>}</footer>
    </div>
  </dialog>, document.body);
}
