"use client";

import { useState } from "react";
import { useWeeklyPrompt } from "../../../hooks/use-weekly-prompt";
import styles from "./prompts.module.css";

const dismissalKey = "myschlawgs-weekly-prompt-dismissed";

function WeeklyPromptToast({ publication, text }: { publication: string; text: string }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissalKey) === publication; }
    catch { return false; }
  });

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(dismissalKey, publication); }
    catch { /* The toast can still be dismissed when browser storage is unavailable. */ }
  }

  if (dismissed) return null;
  return <aside className={styles.promptToast} aria-label="Idea of the Week">
    <p role="status"><strong>Idea of the Week</strong>{text}</p>
    <button type="button" className={styles.dismissPrompt} onClick={dismiss}>Dismiss</button>
  </aside>;
}

export default function WeeklyPrompt() {
  const { data } = useWeeklyPrompt();
  if (!data?.prompt) return null;
  const { weekOf, ideaId, text } = data.prompt;
  const publication = `${weekOf}:${ideaId}`;
  return <WeeklyPromptToast key={publication} publication={publication} text={text} />;
}
