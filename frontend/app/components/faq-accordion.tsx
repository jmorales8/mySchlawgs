"use client";

import { useId, useState, type ReactNode } from "react";
import styles from "./faq-accordion.module.css";

export default function FAQAccordion({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return <div className={styles.accordion}>
    <button type="button" className={styles.question} id={`${id}-question`} aria-expanded={open} aria-controls={`${id}-answer`} onClick={() => setOpen(value => !value)}>
      <span className={`${styles.arrow} ${open ? styles.rotated : ""}`} aria-hidden="true">▸</span>
      <span>{title}</span>
    </button>
    <div id={`${id}-answer`} role="region" aria-labelledby={`${id}-question`} aria-hidden={!open} inert={!open} className={`${styles.answer} ${open ? styles.open : ""}`}>
      <div className={styles.clip}><div className={styles.content}>{children}</div></div>
    </div>
  </div>;
}
