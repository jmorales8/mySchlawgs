import { useState } from "react";
import { api } from "../components/api";
import sharedStyles from "../components/community/community.module.css";
import { useApiQuery } from "../hooks/use-api-query";
import styles from "./page.module.css";
import DisputeForm from "../components/community/moderation/dispute-form";

type RestrictedAccount = {
  id: string;
  username: string;
  postingRestrictedAt: string;
  restrictedSince: string;
  appeal: { id: string; explanation: string; accepted: boolean | null; decisionReason: string | null } | null;
};

function waitingTime(value: string, now: number | null) {
  if (now === null) return "";
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60000));
  if (minutes < 1) return " · Less than a minute";
  const [amount, unit] = minutes >= 1440 ? [Math.floor(minutes / 1440), "day"]
    : minutes >= 60 ? [Math.floor(minutes / 60), "hour"] : [minutes, "minute"];
  return ` · Waiting ${amount} ${unit}${amount === 1 ? "" : "s"}`;
}

export default function PostingRestrictions({ adminId }: { adminId: string }) {
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { data: accounts = [], loading, error: loadError, refresh, updatedAt } = useApiQuery<RestrictedAccount[]>(
    `/api/moderation/accounts/restricted?page=${page}`, { authenticated: true, refetchInterval: 60_000 },
  );

  async function lift(account: RestrictedAccount) {
    setBusy(account.id);
    setError("");
    setNotice("");
    try {
      await api(`/api/moderation/accounts/${account.id}/posting-restriction?restrictedAt=${encodeURIComponent(account.postingRestrictedAt)}`, { method: "DELETE" });
      setNotice(`@${account.username} can post and comment again.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      await refresh();
      setBusy(null);
    }
  }

  return <section className={sharedStyles.card} aria-labelledby="posting-restrictions-heading">
    <h2 id="posting-restrictions-heading">Posting restrictions</h2>
    <p>Reported accounts can react while posting and commenting are paused. Review the reports before lifting a restriction.</p>
    {loading && <p role="status">Loading restricted accounts…</p>}
    {(error || loadError) && <p className={styles.error} role="alert">{error || loadError}</p>}
    {notice && <p role="status">{notice}</p>}
    {!loading && !loadError && <>
      {accounts.length === 0 ? <p>No restricted accounts on this page.</p> : <ul>{accounts.map(account => <li key={account.id}>
        <p><strong>@{account.username}</strong> · Restricted since <time dateTime={account.restrictedSince}>{new Date(account.restrictedSince).toLocaleString()}</time>{waitingTime(account.restrictedSince, updatedAt || null)}</p>
        {account.appeal && <>
          <p><strong>{account.appeal.accepted === null ? "Appeal awaiting review" : "Appeal declined"}</strong></p>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{account.appeal.explanation}</p>
          {account.appeal.decisionReason && <p>Decision: {account.appeal.decisionReason}</p>}
        </>}
        {account.id === adminId ? <p>Another admin must review your restriction.</p> : account.appeal?.accepted === null ?
          <DisputeForm key={account.appeal.id} review appealPath={`/api/moderation/accounts/${account.id}/posting-appeal/${account.appeal.id}?restrictedAt=${encodeURIComponent(account.postingRestrictedAt)}`} onSaved={refresh} /> :
          <button type="button" disabled={busy !== null} aria-label={`Lift posting restriction for @${account.username}`} onClick={() => void lift(account)}>
            {busy === account.id ? "Lifting restriction…" : "Lift restriction"}
          </button>}
      </li>)}</ul>}
      {page > 0 && <button type="button" disabled={busy !== null} onClick={() => setPage(page - 1)}>Previous restricted accounts</button>}
      {accounts.length === 20 && <button type="button" disabled={busy !== null} onClick={() => setPage(page + 1)}>Next restricted accounts</button>}
    </>}
  </section>;
}
