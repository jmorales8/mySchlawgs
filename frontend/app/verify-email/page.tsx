"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../components/api";
import styles from "../account/email/verification.module.css";

export default function VerifyEmailPage() {
  const [link, setLink] = useState<{ userId: string; token: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const params = new URLSearchParams(window.location.hash.slice(1));
      const userId = params.get("userId"), token = params.get("token");
      if (userId && token) setLink({ userId, token });
      setReady(true);
      // Remove the secret from the address bar without sending it to the server.
      window.history.replaceState(null, "", window.location.pathname);
    });
    return () => { active = false; };
  }, []);
  async function confirm() {
    if (!link || busy) return;
    setBusy(true); setError("");
    try { await api("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(link) }); setDone(true); setLink(null); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <main className={styles.page}><Link href="/">Back to the community</Link><h1>{done ? "Your email is verified" : "Confirm your email"}</h1>
    {!ready ? <p role="status">Loading verification link…</p> : done ? <p role="status">Your email address is now verified on your mySchlawgs account.</p> : link ? <><p>Confirm that you want to verify this email address for your mySchlawgs account.</p><button disabled={busy} onClick={confirm}>{busy ? "Verifying…" : "Verify email address"}</button></> : <p>This link is missing its verification details. Open the original link from your email, or request another below.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!done && ready && <p><Link href="/account/email">Add your email or request a new link</Link></p>}
  </main>;
}
