import Link from "next/link";
import { TutorialLink } from "../tutorial/tutorial";
import styles from "./site-footer.module.css";

export default function SiteFooter({ mission = false }: { mission?: boolean }) {
  return <footer className={styles.footer}><Link href="/">mySchlawgs</Link><Link href="/our-mission" aria-current={mission ? "page" : undefined}>Our mission</Link><TutorialLink /><Link href="/faq">FAQ</Link><Link href="/privacy">Privacy</Link><span></span></footer>;
}
