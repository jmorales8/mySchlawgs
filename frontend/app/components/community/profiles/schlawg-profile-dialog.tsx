"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./schlawg-profile-dialog.module.css";
import sharedStyles from "../community.module.css";
import { useAccount } from "../../../contexts/account-context";

export type SchlawgProfile = { id: string; name: string; animalType: string; breed: string; funFact: string; profilePhotoUrl: string | null };

export default function SchlawgProfileDialog({ animal, onClose }: { animal: SchlawgProfile; onClose: () => void }) {
  const { user, ready, voteBusy, voteForAnimal } = useAccount();
  const [voteError, setVoteError] = useState("");
  const [voteNotice, setVoteNotice] = useState("");
  const selected = user?.votingForAnimalId === animal.id;
  async function vote() {
    setVoteError(""); setVoteNotice("");
    try {
      await voteForAnimal(selected ? null : animal.id);
      setVoteNotice(selected ? "Your vote has been removed." : `Your vote for ${animal.name} is saved.`);
    } catch (error) { setVoteError((error as Error).message); }
  }
  const profileDialog = useRef<HTMLDialogElement>(null);
  const profileTitle = useId();
  const [closing, setClosing] = useState(false);
  const closingStarted = useRef(false);
  const closeFinished = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function finishClose() {
    if (closeFinished.current) return;
    closeFinished.current = true;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    onClose();
  }
  function requestClose() {
    if (closingStarted.current) return;
    closingStarted.current = true;
    setClosing(true);
    // Still close if the browser suppresses animation events.
    closeTimer.current = setTimeout(finishClose, 240);
  }
  useEffect(() => {
    const dialog = profileDialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      dialog.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  return createPortal(<dialog ref={profileDialog} className={`${styles.schlawgDialog}${closing ? ` ${styles.closing}` : ""}`} aria-labelledby={profileTitle} onAnimationEnd={event => { if (closing && event.target === event.currentTarget) finishClose(); }} onCancel={event => { event.preventDefault(); requestClose(); }} onClick={event => { if (event.target === event.currentTarget) requestClose(); }}>
      <div className={styles.schlawgDialogContent}>
        <header className={styles.schlawgDialogHeader}><span>Schlawg profile</span><button type="button" className={styles.schlawgDialogClose} aria-label="Close profile" autoFocus onClick={requestClose}>×</button></header>
        {animal.profilePhotoUrl ? <img className={styles.schlawgDialogAvatar} src={animal.profilePhotoUrl} alt="" /> : <span className={`${sharedStyles.schlawgInitial} ${styles.schlawgDialogAvatarFallback}`} aria-hidden="true">{animal.name.slice(0, 1).toUpperCase()}</span>}
        <h3 id={profileTitle}>{animal.name}</h3>
        <div className={styles.voting}>
          <button type="button" className={styles.voteButton} disabled={!ready || !user || voteBusy} aria-pressed={selected} onClick={() => void vote()}>{voteBusy ? "Saving vote…" : selected ? "Voted for schlawg of the week" : "Vote for schlawg of the week"}</button>
          {user ? <p className={styles.voteHint}>{selected ? "Click again to remove your vote." : "One vote per account. Choosing another schlawg replaces your vote."}</p> : <p className={styles.voteHint}>Log in to vote for your favorite schlawg.</p>}
          {voteNotice && <p role="status" className={styles.voteHint}>{voteNotice}</p>}
          {voteError && <p role="alert" className={styles.voteError}>{voteError}</p>}
        </div>
        <dl className={styles.schlawgDetails}>
          <div><dt>Type</dt><dd>{animal.animalType}</dd></div>
          <div><dt>Breed</dt><dd>{animal.breed || "Not specified"}</dd></div>
          <div className={styles.funFact}><dt>Fun fact</dt><dd>{animal.funFact?.trim() || "Not specified"}</dd></div>
        </dl>
      </div>
    </dialog>, document.body);
}
