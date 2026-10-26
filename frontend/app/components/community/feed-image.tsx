"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useState } from "react";
import styles from "./community.module.css";
import type { Photo } from "./types";

export default function FeedImage({ photo }: { photo: Photo }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const imageRef = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) setState("ready");
  }, []);
  return <div className={styles.photoFrame}>
    {state === "loading" && <span className={`${styles.skeleton} ${styles.imagePlaceholder}`} aria-hidden="true" />}
    <img ref={imageRef}
      className={`${styles.photo} ${styles.feedImage} ${state === "ready" ? styles.imageReady : ""}`}
      loading="lazy" decoding="async" draggable={false} src={photo.downloadUrl}
      onLoad={() => setState("ready")} onError={() => setState("error")}
      alt={photo.description || `An animal photo shared by ${photo.username ?? "the schlawgs"}`} />
    {state === "error" && <span className={styles.imageError}>This photo couldn’t load. Open it to try again.</span>}
  </div>;
}
