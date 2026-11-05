"use client";

import { useId, useState } from "react";
import styles from "./post-social.module.css";

export default function FeaturedQuote({ body, username }: { body: string; username: string }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const compact = body.replace(/\s+/g, " ").trim();
  const long = compact.length > 180 || body.split("\n").length > 3;
  const preview = compact.length > 180 ? `${compact.slice(0, 180).replace(/\s+\S*$/, "")}…` : compact;
  return <blockquote><span id={id}>“{long && !expanded ? preview : body}”</span> <cite>— @{username}</cite>
    {long && <> <button type="button" className={styles.quoteReadMore} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>{expanded ? "Read less" : "Read more"}</button></>}
  </blockquote>;
}
