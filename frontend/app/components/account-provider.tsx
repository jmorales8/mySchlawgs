"use client";

import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

export type User = { isAdmin: boolean; isModerator: boolean; id: string; username: string; profilePhotoUrl: string | null };

const AccountContext = createContext<{
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  ready: boolean;
  accountError: string;
} | null>(null);

export default function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [accountError, setAccountError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" }).then(async response => {
      if (response.ok) { const account: User = await response.json(); if (active) setUser(account); }
      else if (response.status !== 401) throw new Error();
    }).catch(() => { if (active) setAccountError("Couldn't connect to your account. Please refresh to try again."); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  return <AccountContext.Provider value={{ user, setUser, ready, accountError }}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const account = useContext(AccountContext);
  if (!account) throw new Error("useAccount requires AccountProvider");
  return account;
}
