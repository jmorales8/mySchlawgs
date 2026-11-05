"use client";

import { useEffect, useState } from "react";
import styles from "./privacy.module.css";

const sections = [
  ["collect", "What we collect"], ["use", "How we use it"],
  ["public", "What’s public"], ["storage", "Storage & retention"],
  ["cookies", "Cookies & security"], ["choices", "Your choices"],
  ["sharing", "Before you share"],
];

export default function PrivacyContents() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const targets = sections.map(([id]) => document.getElementById(id));
    let frame = 0;

    function update() {
      frame = 0;
      const readingLine = Math.min(160, window.innerHeight * .25);
      let current: string | null = null;
      for (const target of targets) {
        if (target && target.getBoundingClientRect().top <= readingLine) current = target.id;
      }
      // The final section may be too short to reach the reading line.
      if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
        current = sections[sections.length - 1][0];
      }
      setActive(current);
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return <nav className={styles.contents} aria-label="Privacy sections">
    <h2>On this page</h2>
    <ul>{sections.map(([id, label]) => <li key={id}><a href={`#${id}`} aria-current={active === id ? "location" : undefined}>{label}</a></li>)}</ul>
  </nav>;
}
