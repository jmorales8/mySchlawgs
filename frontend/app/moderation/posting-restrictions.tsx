import { useState } from "react";
import { api } from "../components/api";
import sharedStyles from "../components/community/community.module.css";
import { useApiQuery } from "../hooks/use-api-query";
import styles from "./page.module.css";

type RestrictedAccount = { id: string; username: string; postingRestrictedAt: string };

export default function PostingRestrictions({ adminId }: { adminId: string }) {
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { data: accounts = [], loading, error: loadError, refresh } = useApiQuery<RestrictedAccount[]>(
    `/api/moderation/accounts/restricted?page=${page}`, { authenticated: true },
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
        <p>@{account.username} · <time dateTime={account.postingRestrictedAt}>{new Date(account.postingRestrictedAt).toLocaleString()}</time></p>
        {account.id === adminId ? <p>Another admin must review your restriction.</p> :
          <button type="button" disabled={busy !== null} aria-label={`Lift posting restriction for @${account.username}`} onClick={() => void lift(account)}>
            {busy === account.id ? "Lifting restriction…" : "Lift restriction"}
          </button>}
      </li>)}</ul>}
      {page > 0 && <button type="button" disabled={busy !== null} onClick={() => setPage(page - 1)}>Previous restricted accounts</button>}
      {accounts.length === 20 && <button type="button" disabled={busy !== null} onClick={() => setPage(page + 1)}>Next restricted accounts</button>}
    </>}
  </section>;
}
