import { useState, type FormEvent } from "react";
import { api } from "../components/api";
import sharedStyles from "../components/community/community.module.css";
import styles from "./page.module.css";

type Account = {
  id: string;
  username: string;
  isAdmin: boolean;
  schlawgs: number;
  posts: number;
  photos: number;
  comments: number;
  reactions: number;
};

export default function AccountBan() {
  const [username, setUsername] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setAccount(null);
    setConfirmation("");
    try {
      setAccount(await api<Account>(`/api/moderation/accounts/lookup?username=${encodeURIComponent(username.trim())}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function ban(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !account || account.isAdmin || confirmation !== account.username) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/moderation/accounts/${account.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: confirmation }),
      });
      setNotice(`@${account.username} was banned and the account was deleted.`);
      setAccount(null);
      setConfirmation("");
      setUsername("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <section className={sharedStyles.card} aria-labelledby="account-ban-heading">
    <h2 id="account-ban-heading">Ban an account</h2>
    <form onSubmit={lookup}>
      <label>Username<input value={username} required maxLength={30} disabled={busy} onChange={event => {
        setUsername(event.target.value);
        setAccount(null);
        setConfirmation("");
        setError("");
        setNotice("");
      }} /></label>
      <button disabled={busy || !username.trim()}>Look up username</button>
    </form>
    {account && <>
      <h3>@{account.username}</h3>
      <p>{account.schlawgs} schlawgs · {account.posts} posts · {account.photos} photos · {account.comments} comments · {account.reactions} likes and reactions</p>
      {account.isAdmin ? <p>Administrator accounts are protected.</p> : <form onSubmit={ban}>
        <p>This permanently deletes the account and its content, signs it out, and blocks reuse of its username.</p>
        <label>Type {account.username} to confirm<input value={confirmation} maxLength={30} disabled={busy} autoComplete="off" onChange={event => setConfirmation(event.target.value)} /></label>
        <button disabled={busy || confirmation !== account.username}>{busy ? "Banning account…" : "Ban and delete account"}</button>
      </form>}
    </>}
    {busy && !account && <p role="status">Looking up username…</p>}
    {notice && <p role="status">{notice}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
