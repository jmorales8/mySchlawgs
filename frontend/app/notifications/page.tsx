import Link from "next/link";
import NotificationInbox from "../components/notifications/notification-inbox";
import sharedStyles from "../components/community/community.module.css";
export default function NotificationsPage() {
  return <main className={sharedStyles.shell}><nav className={sharedStyles.nav}><Link href="/">← Community</Link><Link href="/account/reports">Your reports & disputes</Link></nav><div style={{ maxWidth: 850, padding: 24, margin: "auto" }}><NotificationInbox /></div></main>;
}
