"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./schlawg-profile-dialog.module.css";
import sharedStyles from "../community.module.css";

export type SchlawgProfile = { id: string; name: string; animalType: string; breed: string; profilePhotoUrl: string | null };

export default function SchlawgProfileDialog({ animal, onClose }: { animal: SchlawgProfile; onClose: () => void }) {
  const profileDialog = useRef<HTMLDialogElement>(null);
  const profileTitle = useId();
  useEffect(() => {
    const dialog = profileDialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  return createPortal(<dialog ref={profileDialog} className={styles.schlawgDialog} aria-labelledby={profileTitle} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.schlawgDialogContent}>
        <header className={styles.schlawgDialogHeader}><span>Schlawg profile</span><button type="button" className={styles.schlawgDialogClose} aria-label="Close profile" autoFocus onClick={() => onClose()}>×</button></header>
        {animal.profilePhotoUrl ? <img className={styles.schlawgDialogAvatar} src={animal.profilePhotoUrl} alt="" /> : <span className={`${sharedStyles.schlawgInitial} ${styles.schlawgDialogAvatarFallback}`} aria-hidden="true">{animal.name.slice(0, 1).toUpperCase()}</span>}
        <h3 id={profileTitle}>{animal.name}</h3>
        <dl className={styles.schlawgDetails}>
          <div><dt>Type</dt><dd>{animal.animalType}</dd></div>
          <div><dt>Breed</dt><dd>{animal.breed || "Not specified"}</dd></div>
        </dl>
      </div>
    </dialog>, document.body);
}
