"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useAccount } from "../contexts/account-context";
import { api } from "../components/api";
import styles from "../account/email/verification.module.css";

export default function ResetPasswordPage() {
  const { setUser } = useAccount();
  const [link, setLink] = useState<{ userId: string; token: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const params = new URLSearchParams(window.location.hash.slice(1));
      const userId = params.get("userId"), token = params.get("token");
      if (userId && token && /^[a-fA-F0-9]{64}$/.test(token)) setLink({ userId, token });
      setReady(true);
      window.history.replaceState(null, "", window.location.pathname);
    });
    return () => { active = false; };
  }, []);
  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!link || busy) return;
    setError("");
    if (password !== confirmation) { setError("The passwords don't match. Enter the same password in both fields."); return; }
    setBusy(true);
    try {
      await api("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...link, password, confirmPassword: confirmation }) });
      setDone(true); setLink(null); setPassword(""); setConfirmation(""); setUser(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <main className={styles.page}>
    <Link href="/#account">Back to login or signup</Link><h1>{done ? "Your password has been reset" : "Choose a new password"}</h1>
    {!ready ? <p role="status">Loading your reset link…</p> : done ? <><p role="status">Your previous sessions have been signed out. Log in with your username and new password.</p><Link href="/#account">Return to mySchlawgs</Link></> : !link ? <p>This link is missing its reset details. Open the original link from your email or request another below.</p> : <>
      <p>Choose a password with 8–128 characters. Resetting it will sign out all existing sessions.</p>
      <form className={styles.resetForm} onSubmit={reset} aria-busy={busy}>
        <label htmlFor="new-password">New password</label>
        <input id="new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy} value={password} onChange={event => setPassword(event.target.value)} />
        <label htmlFor="confirm-password">Confirm new password</label>
        <input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} />
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <button disabled={busy}>{busy ? "Resetting password…" : "Reset password"}</button>
      </form>
    </>}
    {ready && !done && <p><Link href="/forgot-password">Request a new reset link</Link></p>}
  </main>;
}
