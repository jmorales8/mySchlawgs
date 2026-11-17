"use client";

import { useId, useState, type FormEvent } from "react";
import { api } from "../../api";
import styles from "./prompts.module.css";

export default function PromptIdeaForm({ staff = false }: { staff?: boolean }) {
  const inputId = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/api/prompt-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setText("");
      setNotice(staff ? "Idea added to the queue." : "Thanks! Your idea was sent for review.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <form className={styles.ideaForm} onSubmit={submit}>
    <label htmlFor={inputId}>{staff ? "New prompt idea" : "Suggest a future prompt"}</label>
    {staff ? <textarea id={inputId} rows={2} maxLength={240} required disabled={busy} value={text}
      onChange={event => setText(event.target.value)} /> : <input id={inputId} type="text" maxLength={240} required disabled={busy} value={text}
      onChange={event => setText(event.target.value)} />}
    <button type="submit" disabled={busy || !text.trim()}>{busy ? "Saving…" : staff ? "Add idea" : "Send idea"}</button>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </form>;
}
