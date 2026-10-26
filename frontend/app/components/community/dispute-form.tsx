"use client";
import { useState } from "react";
import { api } from "../api";
export default function DisputeForm({ id, review = false, onSaved }: { id: string; review?: boolean; onSaved: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <form onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api(review ? `/api/moderation/disputes/${id}/decision` : `/api/account/reports/${id}/dispute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(review ? { accept, reason: text } : { explanation: text }) });
      setText(""); await onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}>
    <h3>{review ? "Review dispute" : "Dispute reports or takedown"}</h3>
    {review && <label>Decision <select value={accept ? "accept" : "reject"} disabled={busy} onChange={event => setAccept(event.target.value === "accept")}><option value="reject">Reject dispute — keep current status</option><option value="accept">Accept — dismiss active reports and restore post</option></select></label>}
    <label>{review ? "Explain your decision to the author" : "Explain why the reports or removal should be reconsidered"}<textarea required maxLength={review ? 1000 : 2000} disabled={busy} value={text} onChange={event => setText(event.target.value)} /></label>
    <button disabled={busy || !text.trim()} style={{ marginTop: 12 }}>{busy ? "Saving…" : review ? "Confirm decision" : "Submit dispute"}</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}
