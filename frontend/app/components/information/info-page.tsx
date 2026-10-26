import SiteFooter from "./site-footer";
import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./info-page.module.css";

export default function InfoPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return <div className={styles.page}>
    <nav className={styles.nav} aria-label="Main navigation"><Link href="/">mySchlawgs</Link><Link href="/">Back to the community ↗</Link></nav>
    <main className={styles.main}><header><p className={styles.eyebrow}>A little care goes a long way</p><h1>{title}</h1><p className={styles.intro}>{intro}</p></header>{children}</main>
    <SiteFooter />
  </div>;
}
