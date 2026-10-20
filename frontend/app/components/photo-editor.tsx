"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { fullCrop, moveCrop, type Crop } from "./photo-crop";
import styles from "./photo-editor.module.css";

export default function PhotoEditor({ file, onCancel, onApply }: { file: File; onCancel: () => void; onApply: (file: File) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [crop, setCrop] = useState<Crop>(fullCrop);
  const surface = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; handle: string; x: number; y: number; width: number; height: number; crop: Crop } | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current!;
    const focus = document.activeElement as HTMLElement | null;
    element.showModal();
    let active = true;
    let bitmap: ImageBitmap | undefined;
    createImageBitmap(file).then(result => { if (!active) { result.close(); return; } bitmap = result; setImage(result); }).catch(() => { if (active) setError("This image couldn’t be opened. Cancel to keep the original."); });
    return () => { active = false; bitmap?.close(); element.close(); if (focus?.isConnected) focus.focus(); };
  }, [file]);
  useEffect(() => {
    if (!image || !canvas.current) return;
    const scale = Math.min(1, 2048 / Math.max(image.width, image.height));
    const w = Math.round(image.width * scale), h = Math.round(image.height * scale);
    const rotated = document.createElement("canvas");
    rotated.width = rotation % 2 ? h : w; rotated.height = rotation % 2 ? w : h;
    const context = rotated.getContext("2d")!;
    context.translate(rotated.width / 2, rotated.height / 2);
    context.rotate(-rotation * Math.PI / 2);
    context.drawImage(image, -w / 2, -h / 2, w, h);
    const selection = preview ? crop : fullCrop;
    const cw = rotated.width * (selection.right - selection.left);
    const ch = rotated.height * (selection.bottom - selection.top);
    const target = canvas.current;
    target.width = Math.max(1, Math.round(cw)); target.height = Math.max(1, Math.round(ch));
    const output = target.getContext("2d")!;
    output.drawImage(rotated, rotated.width * selection.left, rotated.height * selection.top, cw, ch, 0, 0, target.width, target.height);
    if (brightness !== 100) {
      const pixels = output.getImageData(0, 0, target.width, target.height);
      for (let i = 0; i < pixels.data.length; i += 4) for (let c = 0; c < 3; c++) pixels.data[i + c] *= brightness / 100;
      output.putImageData(pixels, 0, 0);
    }
  }, [image, rotation, brightness, crop, preview]);
  function start(event: PointerEvent<HTMLButtonElement>, handle: string) {
    if (event.button !== 0 || drag.current || !surface.current) return;
    const bounds = surface.current.getBoundingClientRect();
    event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, handle, x: event.clientX, y: event.clientY, width: bounds.width, height: bounds.height, crop };
  }
  const aspect = image ? (rotation % 2 ? image.height / image.width : image.width / image.height) * (preview ? (crop.right - crop.left) / (crop.bottom - crop.top) : 1) : 1;
  async function apply() {
    if (!canvas.current || saving) return;
    setSaving(true); setError("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.current!.toBlob(value => value ? resolve(value) : reject(new Error("Couldn’t save this edit.")), "image/png"));
      if (blob.size > 10 * 1024 * 1024) throw new Error("Edited image exceeds 10 MB. Try a smaller crop.");
      onApply(new File([blob], file.name.replace(/\.[^.]+$/, "") + "-edited.png", { type: "image/png" }));
    } catch (e) { setError((e as Error).message); setSaving(false); }
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="edit-photo-title" onCancel={event => { event.preventDefault(); if (!saving) onCancel(); }}>
    <div className={styles.inner}>
      <header><h2 id="edit-photo-title">{preview ? "Preview your photo" : "Edit your photo"}</h2><button type="button" disabled={saving} onClick={onCancel} aria-label="Cancel photo edits">✕</button></header>
      <p>Your original stays unchanged until you apply. Edited photos are saved as PNG, up to 2048 pixels on the longest side. Animated images become a still photo.</p>
      <div className={styles.preview}><div ref={surface} className={styles.cropSurface} style={{ width: `min(100%, ${38 * aspect}dvh)` }}>
        <canvas ref={canvas} aria-label="Live preview of the edited photo" />
        {image && !preview && <div className={styles.cropBox} style={{ left: `${crop.left * 100}%`, top: `${crop.top * 100}%`, width: `${(crop.right - crop.left) * 100}%`, height: `${(crop.bottom - crop.top) * 100}%` }}>
          {["move", "n", "ne", "e", "se", "s", "sw", "w", "nw"].map(handle => <button key={handle} type="button" className={`${styles.cropHandle} ${styles[handle]}`} aria-label={handle === "move" ? "Move crop selection" : `Resize crop ${ { n: "top", ne: "top right", e: "right", se: "bottom right", s: "bottom", sw: "bottom left", w: "left", nw: "top left" }[handle]}`} aria-describedby="crop-help" onPointerDown={event => start(event, handle)} onPointerMove={event => {
            const current = drag.current;
            if (current?.id === event.pointerId) setCrop(moveCrop(current.crop, current.handle, (event.clientX - current.x) / current.width, (event.clientY - current.y) / current.height));
          }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault(); const step = event.shiftKey ? .05 : .01;
            setCrop(value => moveCrop(value, handle, event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0, event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0));
          }} />)}
        </div>}
      </div></div>
      {!preview && <p id="crop-help">Drag inside the dotted box to move it. Drag an edge or corner to resize. You can also focus a handle and use arrow keys (Shift for larger steps).</p>}
      {!image && !error && <p role="status">Loading photo…</p>}
      {!preview && <fieldset disabled={!image || saving} className={styles.controls}>
        <legend>Adjust your photo</legend>
        <button type="button" onClick={() => { setRotation(value => (value + 1) % 4); setCrop(fullCrop); }}>↶ Rotate left 90°</button>
        <label>Brightness · {brightness}%<input type="range" min="30" max="180" value={brightness} onChange={e => setBrightness(Number(e.target.value))} /></label>
        <button type="button" onClick={() => setCrop(fullCrop)}>Reset crop</button>
        <button type="button" onClick={() => { setRotation(0); setBrightness(100); setCrop(fullCrop); }}>Reset edits</button>
      </fieldset>}
      {error && <p role="alert">{error}</p>}
      <footer><button type="button" disabled={saving} onClick={preview ? () => setPreview(false) : onCancel}>{preview ? "Keep editing" : "Cancel"}</button><button type="button" disabled={!image || saving} onClick={preview ? () => void apply() : () => setPreview(true)}>{saving ? "Saving…" : preview ? "Apply & continue" : "Preview photo"}</button></footer>
    </div>
  </dialog>;
}
