"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { cropBounds } from "./profile-crop";
import styles from "./profile-cropper.module.css";

type Props = { file: File; onCancel: () => void; onSave: (file: File) => Promise<void> };
type Position = { x: number; y: number; zoom: number };

export default function ProfileCropper({ file, onCancel, onSave }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; position: Position } | null>(null);
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0, zoom: 1 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const element = dialog.current!;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    let active = true;
    let bitmap: ImageBitmap | undefined;
    createImageBitmap(file).then(result => {
      if (!active) { result.close(); return; }
      bitmap = result;
      setImage(result);
      setPosition({ x: result.width / 2, y: result.height / 2, zoom: 1 });
    }).catch(() => { if (active) setError("This photo couldn’t be opened. Choose a different image."); });
    return () => {
      active = false;
      bitmap?.close();
      element.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, [file]);

  useEffect(() => {
    if (!image) return;
    const crop = cropBounds(image.width, image.height, position.zoom, position.x, position.y);
    for (const target of [canvas.current, preview.current]) {
      if (!target) continue;
      const context = target.getContext("2d")!;
      context.clearRect(0, 0, target.width, target.height);
      context.imageSmoothingQuality = "high";
      context.drawImage(image, crop.left, crop.top, crop.size, crop.size, 0, 0, target.width, target.height);
    }
  }, [image, position]);

  function move(x: number, y: number, zoom = position.zoom) {
    if (!image) return;
    const crop = cropBounds(image.width, image.height, zoom, x, y);
    setPosition({ x: crop.x, y: crop.y, zoom });
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!image || saving || drag.current || event.button !== 0) return;
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, position };
  }

  async function save() {
    if (!image || saving) return;
    setSaving(true); setError("");
    try {
      const crop = cropBounds(image.width, image.height, position.zoom, position.x, position.y);
      const output = document.createElement("canvas");
      output.width = output.height = 512;
      const context = output.getContext("2d");
      if (!context) throw new Error("Your browser couldn’t prepare the photo. Please try again.");
      context.imageSmoothingQuality = "high";
      context.drawImage(image, crop.left, crop.top, crop.size, crop.size, 0, 0, 512, 512);
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error("Couldn’t crop this photo.")), "image/png"));
      await onSave(new File([blob], "profile.png", { type: "image/png" }));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save your photo. Please try again."); }
    finally { setSaving(false); }
  }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="crop-title" aria-describedby="crop-help" onCancel={event => { event.preventDefault(); if (!saving) onCancel(); }}>
    <h2 id="crop-title">Frame your schlawg</h2>
    <p id="crop-help">Drag the photo to position it inside the circle. Zoom in to get closer. You can also use the arrow keys to move it.</p>
    <div className={styles.stage} tabIndex={image && !saving ? 0 : -1} role="group" aria-label="Photo crop area" aria-disabled={saving}
      onPointerDown={startDrag}
      onPointerMove={event => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId || !image || saving) return;
        const scale = Math.min(image.width, image.height) / start.position.zoom / event.currentTarget.getBoundingClientRect().width;
        move(start.position.x - (event.clientX - start.x) * scale, start.position.y - (event.clientY - start.y) * scale, start.position.zoom);
      }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => {
        if (!image || saving || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const step = Math.min(image.width, image.height) / position.zoom * (event.shiftKey ? 0.1 : 0.02);
        move(position.x + (event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0), position.y + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0));
      }}>
      <canvas ref={canvas} width={640} height={640} aria-label="Selected photo crop" />
      <span className={styles.reticle} aria-hidden="true" />
      {!image && <span className={styles.loading}>{error ? "Photo unavailable" : "Opening photo…"}</span>}
    </div>
    <label className={styles.zoom}>Zoom <output>{position.zoom.toFixed(1)}×</output><input type="range" min="1" max="4" step="0.01" value={position.zoom} disabled={!image || saving} onChange={event => move(position.x, position.y, Number(event.target.value))} /></label>
    <div className={styles.preview}><canvas ref={preview} width={160} height={160} aria-label="Circular profile picture preview" /><span>This is how your profile picture will appear.<small>Saved as a still image.</small></span></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}><button type="button" disabled={saving} onClick={onCancel}>Cancel</button><button type="button" disabled={!image || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save profile picture"}</button></div>
  </dialog>;
}
