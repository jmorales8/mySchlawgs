"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "../../components/api";
import { useAccount } from "../../contexts/account-context";
import { useApiQuery } from "../../hooks/use-api-query";
import shared from "../../components/community/community.module.css";
import styles from "../../components/bug-reports.module.css";

const endpoint = "/api/admin/bug-reports";
const statuses = { Open: "Open", InProgress: "In progress", Resolved: "Resolved" };
type Status = keyof typeof statuses;
type Report = {
  id: string;
  title: string;
  encounter: string;
  steps: string;
  createdAt: string;
  reporter: string | null;
};
type QueuePage = { reports: Report[]; hasNext: boolean };

export default function AdminBugReportsPage() {
  const { user, ready, accountError } = useAccount();
  return (
    <main className={shared.shell}>
      <nav className={shared.nav}>
        <Link href="/">← Back to community</Link>
        {user?.isAdmin && <Link href="/moderation">Moderation queue</Link>}
      </nav>
      <section className={styles.content}>
        <h1>Bug report queue</h1>
        {!ready ? <p role="status">Loading your account…</p> :
          accountError && !user ? <p role="alert">{accountError}</p> :
          user?.isAdmin ? <BugQueue key={user.id} /> :
          <p>Sign in with an administrator account to access bug reports.</p>}
      </section>
    </main>
  );
}

function BugQueue() {
  const [status, setStatus] = useState<Status>("Open");
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const { data, loading, error, refresh, refreshing } = useApiQuery<QueuePage>(
    `${endpoint}?status=${status}&page=${page}`, { authenticated: true },
  );

  return <>
    <div className={styles.controls}>
      <label htmlFor="queue-status">Status</label>
      <select id="queue-status" value={status} onChange={event => {
        setStatus(event.target.value as Status);
        setPage(0);
        setNotice("");
      }}>
        {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button type="button" disabled={refreshing} onClick={() => void refresh()}>Refresh queue</button>
    </div>
    <div role="status">{loading ? "Loading reports…" : notice}</div>
    {error && <p role="alert">{error}</p>}
    {data?.reports.length === 0 && <p>No reports on this page.</p>}
    {data?.reports.map(report => (
      <ReportRow key={report.id} report={report} status={status} onSaved={async nextStatus => {
        setNotice(`Report moved to ${statuses[nextStatus].toLowerCase()}.`);
        await refresh();
      }} />
    ))}
    {data && (page > 0 || data.hasNext) && <nav className={styles.controls} aria-label="Bug report pages">
      <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page + 1}</span>
      <button type="button" disabled={!data.hasNext} onClick={() => setPage(page + 1)}>Next</button>
    </nav>}
  </>;
}

function ReportRow({ report, status, onSaved }: {
  report: Report;
  status: Status;
  onSaved: (status: Status) => Promise<void>;
}) {
  const [nextStatus, setNextStatus] = useState(status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || nextStatus === status) return;
    setSaving(true);
    setError("");
    try {
      await api(`${endpoint}/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, previousStatus: status }),
      });
      await onSaved(nextStatus);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return <article className={styles.report}>
    <h2>{report.title}</h2>
    <p className={styles.hint}>
      {report.reporter ? `@${report.reporter}` : "Deleted account"} ·{" "}
      <time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString()}</time>
    </p>
    <details>
      <summary>View report details</summary>
      <dl>
        <dt>How they encountered it</dt><dd>{report.encounter}</dd>
        <dt>Steps to reproduce</dt><dd>{report.steps}</dd>
        <dt>Report ID</dt><dd>{report.id}</dd>
      </dl>
      <form className={styles.controls} onSubmit={save}>
        <label htmlFor={`status-${report.id}`}>Move to</label>
        <select id={`status-${report.id}`} value={nextStatus} disabled={saving} onChange={event => {
          setNextStatus(event.target.value as Status);
        }}>
          {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="submit" disabled={saving || nextStatus === status}>{saving ? "Saving…" : "Save status"}</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </details>
  </article>;
}
