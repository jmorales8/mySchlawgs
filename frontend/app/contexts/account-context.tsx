"use client";

import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { api } from "../components/api";
import { API_CHANGED, type ApiChange } from "../lib/api-events";

export type User = { isAdmin: boolean; isModerator: boolean; id: string; username: string; verifiedEmail: string | null; profilePhotoUrl: string | null; votingForAnimalId: string | null };

const AccountContext = createContext<{
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  ready: boolean;
  accountError: string;
  voteBusy: boolean;
  voteForAnimal: (animalId: string | null) => Promise<void>;
} | null>(null);

export default function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [voteBusy, setVoteBusy] = useState(false);
  const voteInFlight = useRef(false);

  async function voteForAnimal(animalId: string | null) {
    if (!user) throw new Error("Please log in to vote.");
    if (voteInFlight.current) return;
    const accountId = user.id;
    voteInFlight.current = true;
    setVoteBusy(true);
    try {
      const result = await api<{ votingForAnimalId: string | null }>("/api/account/vote", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ animalId }),
      });
      setUser(current => current?.id === accountId ? { ...current, votingForAnimalId: result.votingForAnimalId } : current);
    } finally { voteInFlight.current = false; setVoteBusy(false); }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" }).then(async response => {
      if (response.ok) { const account: User = await response.json(); if (active) setUser(account); }
      else if (response.status !== 401) throw new Error();
    }).catch(() => { if (active) setAccountError("Couldn't connect to your account. Please refresh to try again."); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const currentUserId = user?.id;
  useEffect(() => {
    if (!currentUserId) return;
    let active = true;
    async function refreshAccount() {
      try {
        const account = await api<User>("/api/auth/me");
        if (active) setUser(current => current?.id === currentUserId && account.id === currentUserId ? account : current);
      } catch { /* Keep the current account during temporary connectivity problems. */ }
    }
    function changed(event: Event) {
      if ((event as CustomEvent<ApiChange>).detail?.path === "/api/auth/verify-email") void refreshAccount();
    }
    function visible() { if (document.visibilityState === "visible") void refreshAccount(); }
    window.addEventListener("focus", refreshAccount);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener(API_CHANGED, changed);
    return () => { active = false; window.removeEventListener("focus", refreshAccount); document.removeEventListener("visibilitychange", visible); window.removeEventListener(API_CHANGED, changed); };
  }, [currentUserId]);

  return <AccountContext.Provider value={{ user, setUser, ready, accountError, voteBusy, voteForAnimal }}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const account = useContext(AccountContext);
  if (!account) throw new Error("useAccount requires AccountProvider");
  return account;
}
