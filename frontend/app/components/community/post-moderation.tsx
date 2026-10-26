"use client";
import { useState } from "react";
import { api } from "../api";
import styles from "./post-social.module.css";
import { useAccount } from "../account-provider";

export default function PostModeration({ postId, userId, canModerate, reported, onRemoved }: { postId: string; userId: string | null; canModerate: boolean; reported: boolean; onRemoved: () => Promise<void> }) {
  const [mode, setMode] = useState<"report" | "remove" | null>(null);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const { user } = useAccount();
  async function removePost() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      await api(`/api/moderation/posts/${postId}/remove`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Removed by an administrator from the community feed." }) });
      await onRemoved();
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  return <div className={styles.moderation}>
    <button type="button" className={styles.plain} disabled={busy || sent || reported} onClick={() => { setMode(mode === "report" ? null : "report"); setMessage(""); }}>{sent || reported ? "Report submitted" : "Report post"}</button>
    {canModerate && (user?.isAdmin ? <button type="button" className={styles.plain} disabled={busy} onClick={() => void removePost()}>{busy ? "Removing…" : "Remove post · Admin"}</button> : <button type="button" className={styles.plain} disabled={busy} onClick={() => { setMode("remove"); setDetails(""); setMessage(""); }}>Remove post · Moderator</button>)}
    {mode && (!userId ? <p><a href="#account">Log in or sign up</a> to report this post. Each account can report a post once.</p> : <form onSubmit={async event => {
      event.preventDefault(); if (busy) return; setBusy(true); setMessage("");
      try {
        if (mode === "remove") {
          await api(`/api/moderation/posts/${postId}/remove`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: details }) });
          setMode(null); await onRemoved();
        } else {
          const result = await api<{ removed: boolean; message: string }>(`/api/posts/${postId}/reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, details }) });
          setSent(true); setMode(null); setMessage(result.message); if (result.removed) await onRemoved();
        }
      } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
    }}>
      <h3>{mode === "report" ? "Report this post" : "Remove this post from the community?"}</h3>
      {mode === "report" && <label>Reason<select value={reason} disabled={busy} onChange={event => setReason(event.target.value)}>
        <option value="spam">Spam or scam</option><option value="harassment">Bullying or harassment</option><option value="hate">Hate speech</option><option value="violence">Violence or threats</option><option value="animal-abuse">Animal abuse</option><option value="sexual-content">Sexual content</option><option value="privacy">Privacy violation</option><option value="other">Other</option>
      </select></label>}
      <label>{mode === "report" ? "Details (optional)" : "Removal reason"}<textarea required={mode === "remove"} maxLength={1000} value={details} disabled={busy} onChange={event => setDetails(event.target.value)} /></label>
      <button disabled={busy || (mode === "remove" && !details.trim())}>{busy ? "Saving…" : mode === "report" ? "Submit report" : "Confirm removal"}</button>
      <button type="button" disabled={busy} className={styles.plain} onClick={() => setMode(null)}>Cancel</button>
    </form>)}
    {message && <p role="status">{message}</p>}
  </div>;
}
