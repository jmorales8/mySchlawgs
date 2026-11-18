"use client";

import { useState } from "react";
import { useAccount } from "../../../contexts/account-context";
import PromptIdeaForm from "./prompt-idea-form";
import PromptIdeas from "./prompt-ideas";
import styles from "./prompts.module.css";

export default function PromptSuggestions({ onLogIn }: { onLogIn: () => void }) {
  const { user, ready } = useAccount();
  const [open, setOpen] = useState(false);
  const canSuggest = user && !user.postingRestrictedAt;
  if (!ready || (user && !canSuggest && !user.isAdmin)) return null;

  return <section className={styles.weekly} aria-label="Prompt suggestions">
    {user?.isAdmin && <details onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className={styles.adminSummary}>Choose the Idea of the Week</summary>
      {open && <PromptIdeas isAdmin compact />}
    </details>}
    {canSuggest && <PromptIdeaForm />}
    {!user && <p><a href="#account" onClick={onLogIn}>Log in</a> to suggest a prompt.</p>}
  </section>;
}
