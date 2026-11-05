"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./faq-accordion.module.css";

export default function FAQAccordion({ id, title, defaultOpen = false, children }: { id: string; title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    let frame = 0;
    function revealLinkedAnswer() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (window.location.hash === `#${id}`) setOpen(true);
      });
    }
    revealLinkedAnswer();
    window.addEventListener("hashchange", revealLinkedAnswer);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", revealLinkedAnswer); };
  }, [id]);
  return <div className={styles.accordion} id={id}>
    <div className={styles.headingRow}><h3 className={styles.heading}>
    <button type="button" className={styles.question} id={`${id}-question`} aria-expanded={open} aria-controls={`${id}-answer`} onClick={() => setOpen(value => !value)}>
      <span>{title}</span>
      <svg className={`${styles.arrow} ${open ? styles.rotated : ""}`} aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    </h3><a className={styles.permalink} href={`#${id}`} aria-label={`Link to answer: ${title}`} onClick={() => setOpen(true)}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="m10 14 4-4m-5 7-1 1a4.24 4.24 0 0 1-6-6l4-4a4.24 4.24 0 0 1 6 0m0 8a4.24 4.24 0 0 0 6 0l4-4a4.24 4.24 0 0 0-6-6l-1 1" /></svg></a></div>
    <div id={`${id}-answer`} role="region" aria-labelledby={`${id}-question`} aria-hidden={!open} inert={!open} className={`${styles.answer} ${open ? styles.open : ""}`}>
      <div className={styles.clip}><div className={styles.content}>{children}</div></div>
    </div>
  </div>;
}
