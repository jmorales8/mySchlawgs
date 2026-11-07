"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import sharedStyles from "../community.module.css";
import styles from "./photo-card.module.css";
import Avatar from "../../shared/avatar";
import PhotoFocus from "../../photos/photo-focus";
import FeedImage from "./feed-image";
import PhotoCaption from "./photo-caption";
import PostSocial from "../social/post-social";
import SchlawgProfileDialog, { type SchlawgProfile } from "../profiles/schlawg-profile-dialog";
import type { Photo } from "../types";
import { useAccount } from "../../../contexts/account-context";

export default function PhotoCard({ photos, owner, onSaved, userId }: { photos: Photo[]; userId: string | null; owner: boolean; onSaved: () => Promise<void> }) {
  const { user } = useAccount();
  const [selectedAnimal, setSelectedAnimal] = useState<SchlawgProfile | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [quoteTarget, setQuoteTarget] = useState<HTMLDivElement | null>(null);
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
    const track = trackRef.current;
    if (track) track.scrollTo({ left: next * track.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  function navigate(direction: number) { navigateTo((index + direction + photos.length) % photos.length); }
  return <article className={`${sharedStyles.photoCard} ${styles.postReveal}`} aria-roledescription={photos.length > 1 ? "carousel" : undefined} aria-label={`Photos by ${photo.username ?? "the schlawgs"}`}>
    {selectedAnimal && <SchlawgProfileDialog animal={selectedAnimal} onClose={() => setSelectedAnimal(null)} />}
    {focusIndex !== null && <PhotoFocus photos={photos} initialIndex={focusIndex} onClose={next => { setFocusIndex(null); setActiveIndex(next); trackRef.current?.scrollTo({ left: next * trackRef.current.clientWidth, behavior: "instant" }); }} />}
    <header><Avatar user={photo} className={sharedStyles.avatar} /><div><strong>{photo.username ? `@${photo.username}` : "From the original shclawginsteins"}</strong><time dateTime={photo.uploadedAt}>{new Date(photo.uploadedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time></div>{!!photo.animalProfiles?.length && <ul className={styles.postSchlawgs} aria-label="Schlawgs in this photo">{photo.animalProfiles.map(animal => <li key={animal.id}><button type="button" aria-label={`View ${animal.name}'s profile${user?.votingForAnimalId === animal.id ? ", your vote for schlawg of the week" : ""}`} title={animal.name} aria-haspopup="dialog" onClick={() => setSelectedAnimal(animal)}>{animal.profilePhotoUrl ? <img src={animal.profilePhotoUrl} alt="" width={40} height={40} /> : <span aria-hidden="true">{animal.name.slice(0, 1).toUpperCase()}</span>}</button>{user?.votingForAnimalId === animal.id && <span className={styles.voteCheck} aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg></span>}</li>)}</ul>}</header>
    <div ref={setQuoteTarget} />
    {owner && photo.isUnderReview && <p className={sharedStyles.notice} role="status">This post was reported and is hidden from public feeds while awaiting moderator review. You can still see it here in My photos. <a href={`/account/reports?post=${photo.postId ?? photo.batchId ?? photo.id}`}>View reports or request a review</a>.</p>}
    <div className={styles.carousel} tabIndex={photos.length > 1 ? 0 : undefined} aria-label="Photo viewer. Use left and right arrow keys to browse." onKeyDown={event => {
      if (photos.length < 2 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      event.preventDefault(); navigate(event.key === "ArrowLeft" ? -1 : 1);
    }}>
      <div ref={trackRef} className={styles.carouselTrack} onScroll={event => {
        const track = event.currentTarget;
        if (track.clientWidth) setActiveIndex(Math.min(photos.length - 1, Math.max(0, Math.round(track.scrollLeft / track.clientWidth))));
      }}>
        {photos.map((item, slideIndex) => <button type="button" key={item.id} className={`${styles.carouselSlide} ${styles.openPhoto}`} onClick={() => setFocusIndex(slideIndex)} aria-label={`Open photo ${slideIndex + 1} in focus view`} aria-haspopup="dialog" tabIndex={slideIndex === index ? 0 : -1} aria-hidden={slideIndex !== index} draggable={false}>
          <FeedImage key={item.downloadUrl} photo={item} />
        </button>)}
      </div>
      {photos.length > 1 && <>
        <button type="button" className={`${styles.carouselArrow} ${styles.previous}`} aria-label="Previous photo" onClick={() => navigate(-1)}>‹</button>
        <button type="button" className={`${styles.carouselArrow} ${styles.next}`} aria-label="Next photo" onClick={() => navigate(1)}>›</button>
        <span className={styles.slideCount} aria-live="polite" aria-atomic="true">{index + 1} / {photos.length}</span>
      </>}
      {photos.length > 1 && <div className={styles.carouselDots} aria-label="Choose a photo">{photos.map((item, slideIndex) => <button key={item.id} type="button" aria-label={`Go to photo ${slideIndex + 1}`} aria-pressed={slideIndex === index} onClick={() => navigateTo(slideIndex)}><span /></button>)}</div>}
    </div>
    <PhotoCaption photo={photo} />
    <PostSocial photoCount={photos.length} quoteTarget={quoteTarget} key={userId ?? "guest"} postId={photos[0].postId ?? photos[0].batchId ?? photos[0].id} userId={userId} photoId={photo.id} slideNumber={index + 1} postAuthor={photos[0]} onRemoved={onSaved} />
  </article>;
}
