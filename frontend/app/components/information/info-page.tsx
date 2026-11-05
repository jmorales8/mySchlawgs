import SiteFooter from "./site-footer";
import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./info-page.module.css";

export default function InfoPage({ title, intro, children, article = false, updated, sidebar }: { title: string; intro: string; children: ReactNode; article?: boolean; updated?: string; sidebar?: ReactNode }) {
  return <div className={`${styles.page}${article ? ` ${styles.article}` : ""}`}>
    <nav className={styles.nav} aria-label="Main navigation"><Link href="/">mySchlawgs</Link><Link href="/">Back to the community ↗</Link></nav>
    <main className={`${styles.main}${sidebar ? ` ${styles.withSidebar}` : ""}`}>
      {sidebar && <aside className={styles.sidebar}>{sidebar}</aside>}
      <div className={styles.content}><header>{!article && <p className={styles.eyebrow}>A little care goes a long way</p>}<h1>{title}</h1><p className={styles.intro}>{intro}</p>{updated && <p className={styles.updated}>Updated <time dateTime={updated}>{new Date(`${updated}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</time></p>}</header>{children}</div>
    </main>
    <SiteFooter />
  </div>;
}
