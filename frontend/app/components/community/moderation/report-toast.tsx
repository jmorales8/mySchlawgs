"use client";

import { useEffect, useState } from "react";
import { API_CHANGED, type ApiChange } from "../../../lib/api-events";
import styles from "./report-toast.module.css";

export default function ReportToast() {
  const [reportedItem, setReportedItem] = useState<"Post" | "Comment" | null>(null);

  useEffect(() => {
    let timeout: number | undefined;
    function showReport(event: Event) {
      const change = (event as CustomEvent<ApiChange>).detail;
      if (change?.method !== "POST" || !/^\/api\/posts\/[^/]+\/(?:comments\/[^/]+\/)?reports$/.test(change.path)) return;
      window.clearTimeout(timeout);
      setReportedItem(change.path.includes("/comments/") ? "Comment" : "Post");
      timeout = window.setTimeout(() => setReportedItem(null), 7000);
    }
    window.addEventListener(API_CHANGED, showReport);
    return () => {
      window.removeEventListener(API_CHANGED, showReport);
      window.clearTimeout(timeout);
    };
  }, []);

  return <div className={styles.region}>
    <div role="status">{reportedItem && <p>{reportedItem} has been removed from your feed and the moderators have been notified! Thank you for keeping our schlawgs clean</p>}</div>
    {reportedItem && <button type="button" onClick={() => setReportedItem(null)}>Dismiss</button>}
  </div>;
}
