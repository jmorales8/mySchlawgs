"use client";

import { useId, type FormEventHandler, type Ref } from "react";
import styles from "./post-social.module.css";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  busy: boolean;
  textareaRef: Ref<HTMLTextAreaElement>;
  reply?: boolean;
  onCancel?: () => void;
  error?: string;
  id?: string;
  submitLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
};

export default function CommentComposer({ label, value, onChange, onSubmit, busy, textareaRef, reply = false, onCancel, error, id, submitLabel, pendingLabel = "Sending…", cancelLabel = "Cancel reply" }: Props) {
  const errorId = useId();
  return <form id={id} className={reply ? styles.replyComposer : undefined} onSubmit={onSubmit} aria-label={label} aria-busy={busy}>
    <label>{label}<textarea ref={textareaRef} value={value} onChange={event => onChange(event.target.value)} maxLength={2000} required disabled={busy} aria-describedby={error ? errorId : undefined} placeholder={reply ? "Write your reply to this comment…" : "Leave a little love for this schlawg…"} /></label>
    {error && <p id={errorId} className={styles.error} role="alert">{error}</p>}
    <div className={styles.composerActions}>
      <button disabled={busy || !value.trim()}>{busy ? pendingLabel : submitLabel ?? (reply ? "Post reply" : "Post comment")}</button>
      {onCancel && <button type="button" className={styles.plain} disabled={busy} onClick={onCancel}>{cancelLabel}</button>}
    </div>
  </form>;
}
