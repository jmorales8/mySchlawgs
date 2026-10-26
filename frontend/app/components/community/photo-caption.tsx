"use client";

import { useEffect, useState } from "react";
import { api } from "../api";
import styles from "./community.module.css";
import type { Photo } from "./types";

export default function PhotoCaption({ photo, owner, onSaved, onEditingChange }: { photo: Photo; owner: boolean; onSaved: () => Promise<void>; onEditingChange: (editing: boolean) => void }) {
  useEffect(() => () => onEditingChange(false), [onEditingChange]);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(photo.description);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className={styles.caption} aria-live="polite">{editing ? <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(""); try { await api(`/api/photos/${photo.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description }) }); await onSaved(); setEditing(false); onEditingChange(false); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><label>Description<textarea value={description} maxLength={2000} disabled={busy} onChange={e => setDescription(e.target.value)} /></label><button disabled={busy}>{busy ? "Saving…" : "Save description"}</button><button type="button" className={styles.textButton} disabled={busy} onClick={() => { setEditing(false); onEditingChange(false); }}>Cancel</button>{error && <p role="alert">{error}</p>}</form> : <>{photo.description && <p>{photo.description}</p>}{owner && <button className={styles.textButton} onClick={() => { setDescription(photo.description); setError(""); setEditing(true); onEditingChange(true); }}>{photo.description ? "Edit description" : "Add a description"}</button>}</>}</div>;
}
