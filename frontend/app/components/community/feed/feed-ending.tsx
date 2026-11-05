"use client";

import { useEffect, useRef, useState } from "react";
import { fallbackJoke, type FeedJoke } from "../../../lib/feed-jokes";
import styles from "./feed-ending.module.css";

const animals = ["🐶", "🐱", "🐰", "🦊", "🐻", "🐼", "🐸", "🦉", "🐢", "🦦"];

export default function FeedEnding() {
  const element = useRef<HTMLElement>(null);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [joke, setJoke] = useState<FeedJoke | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let started = false;
    async function reveal() {
      if (started) return;
      started = true;
      setEmoji(animals[Math.floor(Math.random() * animals.length)]);
      const day = new Date().toISOString().slice(0, 10);
      try {
        const cached = JSON.parse(localStorage.getItem("myschlawgs-daily-joke") ?? "null");
        if (cached?.day === day && cached.joke?.source === "jokesone" && typeof cached.joke.setup === "string" && typeof cached.joke.punchline === "string" && cached.joke.setup.length <= 1200 && cached.joke.punchline.length <= 1200) {
          setJoke(cached.joke);
          return;
        }
      } catch { /* Storage may be blocked or contain an old invalid value. */ }
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch("/feed-joke", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error();
        const result: FeedJoke = await response.json();
        if (typeof result.setup !== "string" || typeof result.punchline !== "string" || !["local", "jokesone"].includes(result.source)) throw new Error();
        if (active) {
          setJoke(result);
          if (result.source === "jokesone") {
            try { localStorage.setItem("myschlawgs-daily-joke", JSON.stringify({ day, joke: result })); }
            catch { /* Displaying the joke must not depend on browser storage. */ }
          }
        }
      } catch { if (active) setJoke(fallbackJoke()); }
      finally { clearTimeout(timeout); }
    }
    const observer = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer?.disconnect(); void reveal(); }
    }) : null;
    if (observer && element.current) observer.observe(element.current);
    else void reveal();
    return () => { active = false; observer?.disconnect(); controller.abort(); };
  }, []);
  return <section ref={element} className={styles.ending} aria-label="End of feed">
    <span className={styles.animal} aria-hidden="true">{emoji ?? "\u00a0"}</span>
    <p className={styles.label}>You’ve reached the last post. One little laugh before you go?</p>
    <div className={styles.joke} aria-live="polite" aria-atomic="true">
      {joke ? <><p>{joke.setup}</p>{joke.punchline && <p className={styles.punchline}>{joke.punchline}</p>}</> : <p className={styles.loading}>Finding a little chuckle…</p>}
    </div>
    {joke?.source === "jokesone" && <a className={styles.credit} href="https://jokes.one/" target="_blank" rel="noopener noreferrer">Daily animal jokes by Jokes One</a>}
    {joke?.source === "local" && <small className={styles.fallback}>Showing a local animal joke while the daily joke is unavailable.</small>}
    <a className={styles.back} href="#top">Back to top ↑</a>
  </section>;
}
