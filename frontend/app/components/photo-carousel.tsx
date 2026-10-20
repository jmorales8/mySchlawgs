"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./photo-carousel.module.css";

export type Photo = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  downloadUrl: string;
};

type PhotoCarouselProps = {
  photos: Photo[];
  apiBaseUrl: string;
  apiUnavailable: boolean;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PhotoCarousel({ photos, apiBaseUrl, apiUnavailable }: PhotoCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const previous = useCallback(() => {
    setActiveIndex((current) => (current - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const next = useCallback(() => {
    setActiveIndex((current) => (current + 1) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight") next();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [next, previous]);

  if (photos.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyArt} aria-hidden="true"><span>+</span></div>
        <div>
          <p className={styles.emptyLabel}>
            {apiUnavailable ? "The photo API is resting" : "The roll is empty"}
          </p>
          <h3>
            {apiUnavailable
              ? "Start the .NET backend, then refresh this page."
              : "Upload your first photo to begin the gallery."}
          </h3>
          <p>
            {apiUnavailable
              ? "The frontend expects it at http://localhost:5005 by default."
              : "New uploads will appear here, newest first."}
          </p>
        </div>
      </div>
    );
  }

  const activePhoto = photos[activeIndex];
  const imageUrl = new URL(activePhoto.downloadUrl, apiBaseUrl).toString();

  return (
    <div className={styles.carousel} role="region" aria-roledescription="carousel" aria-label="Uploaded photo gallery">
      <div className={styles.frame}>
        {/* The backend streams dynamic images directly, so intrinsic dimensions are unknown. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={activePhoto.id}
          className={styles.photo}
          src={imageUrl}
          alt={`Uploaded photo ${activeIndex + 1}: ${activePhoto.fileName}`}
        />

        <div className={styles.imageIndex} aria-hidden="true">
          {(activeIndex + 1).toString().padStart(2, "0")}<span>/</span>{photos.length.toString().padStart(2, "0")}
        </div>

        {photos.length > 1 && (
          <div className={styles.controls}>
            <button type="button" onClick={previous} aria-label="Previous photo">←</button>
            <button type="button" onClick={next} aria-label="Next photo">→</button>
          </div>
        )}
      </div>

      <div className={styles.caption} aria-live="polite">
        <div>
          <p className={styles.kicker}>On the roll</p>
          <h3>{activePhoto.fileName}</h3>
        </div>
        <dl className={styles.details}>
          <div><dt>Added</dt><dd>{formatDate(activePhoto.uploadedAt)}</dd></div>
          <div><dt>Format</dt><dd>{activePhoto.contentType.replace("image/", "").toUpperCase()}</dd></div>
          <div><dt>Size</dt><dd>{formatFileSize(activePhoto.size)}</dd></div>
        </dl>
      </div>

      {photos.length > 1 && (
        <div className={styles.pagination} aria-label="Choose a photo">
          {photos.map((photo, index) => (
            <button
              type="button"
              key={photo.id}
              onClick={() => setActiveIndex(index)}
              className={index === activeIndex ? styles.activeDot : undefined}
              aria-label={`Show photo ${index + 1}: ${photo.fileName}`}
              aria-current={index === activeIndex ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
