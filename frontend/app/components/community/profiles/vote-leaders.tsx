"use client";

/* eslint-disable @next/next/no-img-element */
import { useId, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api";
import SchlawgProfileDialog, { type SchlawgProfile } from "./schlawg-profile-dialog";
import HoverLetters from "./hover-letters";
import styles from "./vote-leaders.module.css";
import { useAccount } from "../../../contexts/account-context";

type Summary = { updatedAt: string | null; leaders: (SchlawgProfile & { votes: number })[] };

const countToastDismissalKey = "myschlawgs-vote-count-toast-dismissed";
let countToastDismissedInMemory = false;

function subscribeToCountToastDismissal(onChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key === countToastDismissalKey || event.key === null) onChange();
  }
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}

function getCountToastDismissal() {
  try {
    return countToastDismissedInMemory || localStorage.getItem(countToastDismissalKey) === "1";
  } catch {
    return countToastDismissedInMemory;
  }
}

function getServerCountToastDismissal() { return true; }

function VoteCountStatus({ updatedAt }: { updatedAt: string }) {
  return <>Last counted <time dateTime={updatedAt}>{new Date(updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>. New votes appear after the next count.</>;
}

function formatVotes(votes: number) {
  return `${votes.toLocaleString()} ${votes === 1 ? "vote" : "votes"}`;
}

export default function VoteLeaders({ compact = false }: { compact?: boolean }) {
  const { user } = useAccount();
  const heading = useId();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [notice, setNotice] = useState("");
  const [countNotice, setCountNotice] = useState<"visible" | "closing" | "dismissed">("visible");
  const countToastDismissed = useSyncExternalStore(subscribeToCountToastDismissal, getCountToastDismissal, getServerCountToastDismissal);
  const [selected, setSelected] = useState<SchlawgProfile | null>(null);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["vote-summary"], queryFn: ({ signal }) => api<Summary>("/api/votes/summary", { signal }),
    staleTime: 300_000, refetchInterval: 300_000, retry: false,
  });
  function dismissCountToast() {
    countToastDismissedInMemory = true;
    try { localStorage.setItem(countToastDismissalKey, "1"); }
    catch { /* Keep the dismissal for this page when browser storage is unavailable. */ }
    setCountNotice("closing");
  }
  async function refreshTotals() {
    setRefreshing(true); setRefreshError(""); setNotice("");
    try {
      await api("/api/votes/refresh", { method: "POST" });
      const result = await refetch();
      if (result.isError) throw new Error("Totals were refreshed, but couldn’t be loaded. Please try again.");
      setNotice("Vote totals refreshed.");
    } catch (error) { setRefreshError((error as Error).message); }
    finally { setRefreshing(false); }
  }
  const leaders = data?.leaders ?? [];
  const podiumCutoff = leaders[2]?.votes;
  const podiumLeaders = leaders.filter(animal => podiumCutoff === undefined || animal.votes >= podiumCutoff);
  const places = new Map<number, Summary["leaders"]>();
  for (const animal of podiumLeaders) {
    const group = places.get(animal.votes);
    if (group) group.push(animal);
    else places.set(animal.votes, [animal]);
  }
  const podiumGroups = [...places.values()];
  // Keep vacant slots when the available ranks are all untied.
  if (podiumGroups.length === podiumLeaders.length) {
    while (podiumGroups.length < 3) podiumGroups.push([]);
  }

  const podium = <ol className={styles.podium} data-places={podiumGroups.length} aria-label="Schlawg of the Week podium">
    {podiumGroups.map((animals, index) => {
      const rank = ["1st", "2nd", "3rd"][index];
      const votes = animals[0]?.votes;
      return <li key={rank} className={styles.podiumPlace} data-place={index + 1}>
        <div className={styles.podiumRank}>
          <strong className={styles.rank}>{rank}</strong>
          {compact && votes !== undefined && <span className={styles.podiumVotes}>{formatVotes(votes)}</span>}
        </div>
        {animals.length ? <div className={styles.podiumProfiles}>
          {animals.map(animal => <button key={animal.id} type="button" className={`${styles.profile} ${styles.podiumProfile}`} aria-haspopup="dialog" aria-label={`View ${animal.name}, ${rank} place, ${animal.votes} ${animal.votes === 1 ? "vote" : "votes"}`} onClick={() => setSelected(animal)}>
            <span className={styles.crownedAvatar}>
              {index === 0 && <span className={styles.crown} aria-hidden="true">👑</span>}
              {animal.profilePhotoUrl ? <img src={animal.profilePhotoUrl} alt="" width={40} height={40} /> : <span className={styles.initial} aria-hidden="true">{animal.name.slice(0, 1).toUpperCase()}</span>}
            </span>
            <span className={styles.name}>{compact ? animal.name : <HoverLetters text={animal.name} />}</span>
            {!compact && <span className={styles.podiumVotes}>{formatVotes(animal.votes)}</span>}
          </button>)}
        </div> : <span className={styles.compactStatus}>Awaiting votes</span>}
      </li>;
    })}
  </ol>;
  if (compact) {
    return <section className={styles.compactSummary} aria-labelledby={heading}>
      <h2 id={heading}>Schlawg of the Week</h2>
      {isPending ? <span className={styles.compactStatus} role="status">Loading…</span> : !data ? <button className={styles.retry} onClick={() => void refetch()}>Try again</button> : data.updatedAt && data.leaders.length ? podium : <span className={styles.compactStatus}>{data.updatedAt ? "No votes yet" : "Counting votes…"}</span>}
      {data?.updatedAt && (countNotice === "closing" || (countNotice === "visible" && !countToastDismissed)) && <div
        className={styles.countToast}
        data-closing={countNotice === "closing"}
        onAnimationEnd={() => {
          if (countNotice === "closing") setCountNotice("dismissed");
        }}
      >
        <p role="status"><VoteCountStatus updatedAt={data.updatedAt} /></p>
        <button type="button" className={styles.dismissCountToast} disabled={countNotice === "closing"} onClick={dismissCountToast}>Dismiss</button>
      </div>}
      {selected && <SchlawgProfileDialog animal={selected} onClose={() => setSelected(null)} />}
    </section>;
  }
  return <section className={styles.summary} aria-labelledby={heading}>
    <header className={styles.header}><h2 id={heading}>Schlawg of the Week</h2><p>Top votes · updated hourly</p></header>
    {user?.isAdmin && <div className={styles.adminControls}><button type="button" className={styles.refreshButton} disabled={refreshing} onClick={() => void refreshTotals()}>{refreshing ? "Refreshing totals…" : "Refresh vote totals"}</button>{notice && <p role="status" className={styles.muted}>{notice}</p>}{refreshError && <p role="alert" className={styles.error}>{refreshError}</p>}</div>}
    {isPending ? <p role="status" className={styles.muted}>Gathering the latest totals…</p> : !data ? <p role="alert" className={styles.muted}>Couldn’t load vote totals. <button type="button" className={styles.retry} onClick={() => void refetch()}>Try again</button></p> : <>
      {!data.updatedAt ? <p className={styles.muted}>The first vote count is on its way.</p> : !data.leaders.length ? <p className={styles.muted}>No votes in the latest count. Open a schlawg’s profile to choose your favorite.</p> : <>
        {podium}
        {leaders.length > podiumLeaders.length && <ul className={styles.leaders} aria-label="Other vote leaders">{leaders.slice(podiumLeaders.length).map(animal => <li key={animal.id}><button type="button" className={styles.profile} aria-haspopup="dialog" aria-label={animal.name} onClick={() => setSelected(animal)}>
        {animal.profilePhotoUrl ? <img src={animal.profilePhotoUrl} alt="" width={36} height={36} /> : <span className={styles.initial} aria-hidden="true">{animal.name.slice(0, 1).toUpperCase()}</span>}
        <span className={styles.name}><HoverLetters text={animal.name} /></span></button><span className={styles.count}>{animal.votes.toLocaleString()} {animal.votes === 1 ? "vote" : "votes"}</span></li>)}</ul>}
      </>}
      {data.updatedAt && <p className={styles.updated}><VoteCountStatus updatedAt={data.updatedAt} /></p>}
      {isError && <p role="status" className={styles.muted}>Couldn’t check for an update. Showing the last loaded totals.</p>}
    </>}
    {selected && <SchlawgProfileDialog animal={selected} onClose={() => setSelected(null)} />}
  </section>;
}
