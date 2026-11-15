"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Captcha from "../components/captcha";
import { api } from "../components/api";
import styles from "../account/email/verification.module.css";

const cooldownKey = "myschlawgs-password-reset-retry-at";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const updateCaptcha = useCallback((token: string | null) => setCaptchaToken(token), []);
  useEffect(() => {
    function restoreCooldown() {
      try {
        const saved = Number(localStorage.getItem(cooldownKey));
        if (Number.isFinite(saved) && saved > Date.now()) {
          setRetryAt(saved);
          setSecondsLeft(Math.ceil((saved - Date.now()) / 1000));
        }
      } catch { /* Server still enforces the account cooldown. */ }
    }
    const timer = window.setTimeout(restoreCooldown, 0);
    window.addEventListener("storage", restoreCooldown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", restoreCooldown);
    };
  }, []);
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (!remaining) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  const cooldown = secondsLeft > 0;
  const remainingTime = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || cooldown || captchaToken === null) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ message: string; retryAfterSeconds: number }>("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, captchaToken }) });
      const deadline = Date.now() + result.retryAfterSeconds * 1000;
      setNotice(result.message);
      setRetryAt(deadline);
      setSecondsLeft(result.retryAfterSeconds);
      try { localStorage.setItem(cooldownKey, String(deadline)); }
      catch { /* The current page can still show the countdown. */ }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); setCaptchaToken(null); setAttempt(value => value + 1); }
  }
  return <main className={styles.page}>
    <Link href="/#account">Back to login or signup</Link><h1>Forgot your password?</h1>
    <p>Enter the email address you already verified on your mySchlawgs account. We’ll send a link to choose a new password.</p>
    <p>Recovery requires a verified email. An address that is still waiting for verification can’t be used.</p>
    <form className={styles.resetForm} onSubmit={requestReset} aria-busy={busy}>
      <label htmlFor="recovery-email">Verified email address</label>
      <input id="recovery-email" type="email" autoComplete="email" maxLength={254} required value={email} disabled={busy || cooldown} onChange={event => setEmail(event.target.value)} />
      {!cooldown && <Captcha key={attempt} onChange={updateCaptcha} />}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button disabled={busy || cooldown || captchaToken === null}>{busy ? "Requesting reset…" : "Send password reset link"}</button>
      {cooldown && <p role="timer">You can request another link in {remainingTime}.</p>}
    </form>
    {notice && <p role="status">{notice}</p>}
    <p>The link expires in 30 minutes. Requesting another link replaces the previous one. Your password won’t change until you choose a new one.</p>
  </main>;
}
