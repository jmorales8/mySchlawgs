"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Captcha from "../components/captcha";
import { api } from "../components/api";
import styles from "../account/email/verification.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(false);
  const updateCaptcha = useCallback((token: string | null) => setCaptchaToken(token), []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(false), 60000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || cooldown || captchaToken === null) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ message: string }>("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, captchaToken }) });
      setNotice(result.message); setCooldown(true);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); setCaptchaToken(null); setAttempt(value => value + 1); }
  }
  return <main className={styles.page}>
    <Link href="/#account">Back to login or signup</Link><h1>Forgot your password?</h1>
    <p>Enter the email address you already verified on your mySchlawgs account. We’ll send a link to choose a new password.</p>
    <p>Recovery requires a verified email. An address that is still waiting for verification can’t be used.</p>
    <form className={styles.resetForm} onSubmit={requestReset} aria-busy={busy}>
      <label htmlFor="recovery-email">Verified email address</label>
      <input id="recovery-email" type="email" autoComplete="email" maxLength={254} required value={email} disabled={busy} onChange={event => setEmail(event.target.value)} />
      <Captcha key={attempt} onChange={updateCaptcha} />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button disabled={busy || cooldown || captchaToken === null}>{busy ? "Requesting reset…" : cooldown ? "Wait a minute to request again" : "Send password reset link"}</button>
    </form>
    {notice && <p role="status">{notice}</p>}
    <p>The link expires in 30 minutes. Requesting another link replaces the previous one. Your password won’t change until you choose a new one.</p>
  </main>;
}
