"use client";

import { useState } from "react";
import styles from "./error-toast.module.css";

export default function ErrorToast({ message }: { message: string }) {
  const [dismissed, setDismissed] = useState(false);
  return <div className={styles.region}>
    {!dismissed && <div className={styles.toast} role="alert">
      <div><strong>Something needs your attention</strong><p>{message}</p></div>
      <button type="button" aria-label="Dismiss error" onClick={() => setDismissed(true)}>×</button>
    </div>}
  </div>;
}
