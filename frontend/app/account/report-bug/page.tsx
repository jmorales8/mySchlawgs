"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "../../components/api";
import { useAccount } from "../../contexts/account-context";
import shared from "../../components/community/community.module.css";
import styles from "../../components/bug-reports.module.css";

export default function ReportBugPage() {
  const { user, ready, accountError } = useAccount();
  return (
    <main className={shared.shell}>
      <nav className={shared.nav}><Link href="/">← Back to community</Link></nav>
      <section className={styles.content}>
        <h1>Report a bug</h1>
        {!ready ? <p role="status">Loading your account…</p> :
          accountError && !user ? <p role="alert">{accountError}</p> :
          user ? <BugReportForm key={user.id} /> :
          <p><Link href="/#account">Log in</Link> to send a bug report.</p>}
      </section>
    </main>
  );
}

function BugReportForm() {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    inFlight.current = true;
    setPending(true);
    setSent(false);
    setError("");
    try {
      await api("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      form.reset();
      setSent(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return <>
    <p>Tell us what went wrong so we can reproduce it. Leave out passwords and other private information.</p>
    <form className={styles.form} onSubmit={submit}>
      <label>Summary
        <input name="title" required maxLength={120} readOnly={pending} />
      </label>
      <div className={styles.field}>
        <label htmlFor="bug-encounter">How did you encounter the bug?</label>
        <p className={styles.hint} id="bug-encounter-hint">Include the page, your device or browser, what happened, and what you expected.</p>
        <textarea id="bug-encounter" name="encounter" required maxLength={2000} rows={4} readOnly={pending} aria-describedby="bug-encounter-hint" />
      </div>
      <div className={styles.field}>
        <label htmlFor="bug-steps">Steps to reproduce</label>
        <p className={styles.hint} id="bug-steps-hint">List what you clicked or tapped in order. If you couldn’t reproduce it, describe what you tried.</p>
        <textarea id="bug-steps" name="steps" required maxLength={4000} rows={5} readOnly={pending} aria-describedby="bug-steps-hint" />
      </div>
      <button type="submit" disabled={pending}>{pending ? "Sending…" : "Send report"}</button>
      <div role="status">{sent && "Report sent. Thanks for helping us track down the bug."}</div>
      {error && <p role="alert">{error}</p>}
    </form>
  </>;
}
