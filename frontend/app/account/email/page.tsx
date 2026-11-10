"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useAccount } from "../../contexts/account-context";
import { api } from "../../components/api";
import styles from "./verification.module.css";

type EmailStatus = { email: string | null; pendingEmail: string | null; enabled: boolean; resendAfter: string | null };

export default function EmailPage() {
  const { user, ready, accountError } = useAccount();
  return <main className={styles.page}><Link href="/">Back to the community</Link><h1>{user?.verifiedEmail ? "Your email is verified" : "Verify your email"}</h1>
    {!ready ? <p role="status">Getting your account…</p> : accountError ? <p role="alert">{accountError}</p> : !user ? <p><Link href="/#account">Log in or create an account</Link> to add your email.</p> : <EmailForm key={user.id} />}
  </main>;
}

function EmailForm() {
  const { user } = useAccount();
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [cooldown, setCooldown] = useState(false);
  useEffect(() => {
    let active = true;
    api<EmailStatus>("/api/account/email").then(value => {
      if (active) { setStatus(value); setEmail(value.pendingEmail ?? value.email ?? ""); setCooldown(!!value.resendAfter && new Date(value.resendAfter).getTime() > Date.now()); }
    }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    const remaining = status?.resendAfter ? new Date(status.resendAfter).getTime() - Date.now() : 0;
    const timer = setTimeout(() => setCooldown(false), Math.max(remaining, 0));
    return () => clearTimeout(timer);
  }, [status]);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ message: string }>("/api/account/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      setNotice(result.message);
      setCooldown(true);
      setStatus(current => current ? { ...current, pendingEmail: email.trim(), resendAfter: new Date(Date.now() + 60000).toISOString() } : current);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  if (user?.verifiedEmail) return <p className={styles.message}>Verified Email: <strong>{user.verifiedEmail}</strong></p>;
  return <section>
    {!status?.email && <p>Add an email address to your account. Your username and password will stay the same.</p>}
    {status?.email && <p className={styles.message}>Verified email: <strong>{status.email}</strong></p>}
    {!status?.email && status?.pendingEmail && <p className={styles.message}>Waiting for verification: <strong>{status.pendingEmail}</strong>. Check your inbox and spam folder.</p>}
    {!status && !error && <p role="status">Loading email settings…</p>}
    {!status && error && <button onClick={() => { setError(""); setAttempt(value => value + 1); }}>Try again</button>}
    {status && !status.email && !status.enabled && <p>Email sending isn’t configured yet. Please try again later.</p>}
    {status?.enabled && !status.email && <form onSubmit={send}>
      <label htmlFor="account-email">Email address</label>
      <input id="account-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} aria-describedby="email-help" />
      <p id="email-help">We’ll send a confirmation link that expires in 1 hour. Requesting another link replaces the previous one.</p>
      <button disabled={busy || cooldown || email.trim().toLowerCase() === status.email}>{busy ? "Sending…" : cooldown ? "Wait a minute to resend" : email.trim().toLowerCase() === status.pendingEmail ? "Resend verification email" : "Send verification email"}</button>
    </form>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.message} role="status">{notice}</p>}
  </section>;
}
