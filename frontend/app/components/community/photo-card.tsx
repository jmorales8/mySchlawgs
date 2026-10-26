"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./community.module.css";
import Avatar from "../shared/avatar";
import PhotoFocus from "../photos/photo-focus";
import FeedImage from "./feed-image";
import PhotoCaption from "./photo-caption";
import PostSocial from "./post-social";
import type { Photo } from "./types";

export default function PhotoCard({ photos, owner, onSaved, userId }: { photos: Photo[]; userId: string | null; owner: boolean; onSaved: () => Promise<void> }) {
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [editingCaption, setEditingCaption] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const index = Math.min(activeIndex, photos.length - 1);
  const photo = photos[index];
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let width = track.clientWidth;
    const observer = new ResizeObserver(() => {
      if (track.clientWidth === width) return;
      width = track.clientWidth;
      track.scrollTo({ left: index * track.clientWidth, behavior: "instant" });
    });
    observer.observe(track);
    return () => observer.disconnect();
  }, [index]);
  function navigateTo(next: number) {
    if (editingCaption) return;
    const track = trackRef.current;
    if (track) track.scrollTo({ left: next * track.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  function navigate(direction: number) { navigateTo((index + direction + photos.length) % photos.length); }
  return <article className={`${styles.photoCard} ${styles.postReveal}`} aria-roledescription={photos.length > 1 ? "carousel" : undefined} aria-label={`Photos by ${photo.username ?? "the schlawgs"}`}>
    {focusIndex !== null && <PhotoFocus photos={photos} initialIndex={focusIndex} onClose={next => { setFocusIndex(null); setActiveIndex(next); trackRef.current?.scrollTo({ left: next * trackRef.current.clientWidth, behavior: "instant" }); }} />}
    <header><Avatar user={photo} className={styles.avatar} /><div><strong>{photo.username ? `@${photo.username}` : "From the original shclawginsteins"}</strong><time dateTime={photo.uploadedAt}>{new Date(photo.uploadedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></div></header>
    <div className={styles.carousel} tabIndex={photos.length > 1 ? 0 : undefined} aria-label="Photo viewer. Use left and right arrow keys to browse." onKeyDown={event => {
      if (editingCaption || photos.length < 2 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      event.preventDefault(); navigate(event.key === "ArrowLeft" ? -1 : 1);
    }}>
      <div ref={trackRef} className={styles.carouselTrack} style={editingCaption ? { overflowX: "hidden" } : undefined} onScroll={event => {
        const track = event.currentTarget;
        if (track.clientWidth) setActiveIndex(Math.min(photos.length - 1, Math.max(0, Math.round(track.scrollLeft / track.clientWidth))));
      }}>
        {photos.map((item, slideIndex) => <button type="button" key={item.id} className={`${styles.carouselSlide} ${styles.openPhoto}`} onClick={() => setFocusIndex(slideIndex)} aria-label={`Open photo ${slideIndex + 1} in focus view`} aria-haspopup="dialog" disabled={editingCaption} tabIndex={slideIndex === index ? 0 : -1} aria-hidden={slideIndex !== index} draggable={false}>
          <FeedImage key={item.downloadUrl} photo={item} />
        </button>)}
      </div>
      {photos.length > 1 && <>
        <button type="button" className={`${styles.carouselArrow} ${styles.previous}`} aria-label="Previous photo" disabled={editingCaption} onClick={() => navigate(-1)}>‹</button>
        <button type="button" className={`${styles.carouselArrow} ${styles.next}`} aria-label="Next photo" disabled={editingCaption} onClick={() => navigate(1)}>›</button>
        <span className={styles.slideCount} aria-live="polite" aria-atomic="true">{index + 1} / {photos.length}</span>
      </>}
    </div>
    {photos.length > 1 && <div className={styles.carouselDots} aria-label="Choose a photo">{photos.map((item, slideIndex) => <button key={item.id} type="button" aria-label={`Go to photo ${slideIndex + 1}`} aria-pressed={slideIndex === index} disabled={editingCaption} onClick={() => navigateTo(slideIndex)}><span /></button>)}</div>}
    <PhotoCaption key={`${photo.id}-${owner}`} photo={photo} owner={owner} onSaved={onSaved} onEditingChange={setEditingCaption} />
    <PostSocial key={userId ?? "guest"} postId={photos[0].postId ?? photos[0].batchId ?? photos[0].id} userId={userId} photoId={photo.id} slideNumber={index + 1} postAuthor={photos[0]} onRemoved={onSaved} />
  </article>;
}
