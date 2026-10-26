import Link from "next/link";
import NotificationInbox from "../components/notifications/notification-inbox";
import styles from "../components/community/community.module.css";
export default function NotificationsPage() {
  return <main className={styles.shell}><nav className={styles.nav}><Link href="/">← Community</Link><Link href="/account/reports">Your reports & disputes</Link></nav><div style={{ maxWidth: 850, padding: 24, margin: "auto" }}><NotificationInbox /></div></main>;
}
