import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import AnimalProfileForm, { type Animal } from "./animal-profile-form";
import { api } from "../../components/api";
import ProfileCropper from "../../components/photos/profile-cropper";
import styles from "./profiles.module.css";

export default function CreateProfileDialog({ postPhoto, onSaved, onCancel }: {
  postPhoto?: File;
  onSaved: (animal: Animal) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cropSource, setCropSource] = useState<File | null>(null);
  const [picture, setPicture] = useState<{ cropped: File; preview: string } | null>(null);
  const [createdProfile, setCreatedProfile] = useState<Animal | null>(null);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    return () => { if (picture) URL.revokeObjectURL(picture.preview); };
  }, [picture]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => element.close();
  }, []);

  function cancel() {
    if (busy || uploading || createdProfile) return;
    dialog.current?.close();
    onCancel();
  }

  function finish(animal: Animal) {
    dialog.current?.close();
    onSaved(animal);
  }

  function choosePicture(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) {
      setPhotoError("Choose a JPEG, PNG, GIF, or WebP profile picture up to 10 MB.");
      return;
    }
    setPhotoError("");
    setCropSource(file);
  }

  async function savePicture(animal: Animal, cropped: File) {
    setUploading(true);
    setPhotoError("");
    try {
      const body = new FormData();
      body.append("file", cropped);
      const updated = await api<Animal>(`/api/account/animals/${animal.id}/photo`, { method: "POST", body });
      finish(updated);
    } catch (error) {
      setPhotoError((error as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return <><dialog ref={dialog} className={styles.profileDialog} aria-labelledby={heading} onCancel={event => {
    event.preventDefault();
    cancel();
  }}>
    <h2 id={heading}>Add a schlawg</h2>
    {createdProfile ? <>
      <p role="status">{uploading ? "Uploading profile picture…" : `${createdProfile.name}’s profile was created. You can retry the picture upload or tag the photo without it.`}</p>
      <div className={styles.actions}>
        <button type="button" disabled={uploading} onClick={() => { if (picture) void savePicture(createdProfile, picture.cropped); }}>Retry picture upload</button>
        <button type="button" className={styles.secondary} disabled={uploading} onClick={() => finish(createdProfile)}>Tag without profile picture</button>
      </div>
    </> : <AnimalProfileForm busy={busy} onBusyChange={setBusy} onSaved={animal => {
      if (!picture) { finish(animal); return; }
      setCreatedProfile(animal);
      void savePicture(animal, picture.cropped);
    }} onCancel={cancel} submitLabel="Create profile and tag photo" funFactRows={2} extraFields={
      <div className={`${styles.wide} ${styles.profilePictureChoices}`} role="group" aria-label="Optional profile picture">
        <strong>Profile picture <span className={styles.hint}>Optional</span></strong>
        {picture && <Image unoptimized width={80} height={80} className={styles.animalAvatar} src={picture.preview} alt="Cropped profile picture preview" />}
        <div className={styles.actions}>
          <label className={styles.photoButton}>{picture ? "Choose another picture" : "Choose profile picture"}
            <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={event => {
              choosePicture(event.target.files?.[0]);
              event.target.value = "";
            }} />
          </label>
          {postPhoto && <button type="button" className={styles.secondary} onClick={() => choosePicture(postPhoto)}>Use this post photo</button>}
          {picture && <button type="button" className={styles.secondary} onClick={() => { setPicture(null); setPhotoError(""); }}>Remove picture</button>}
        </div>
      </div>
    } />}
    {photoError && <p role="alert" className={styles.error}>{photoError}</p>}
  </dialog>
    {cropSource && <ProfileCropper file={cropSource} onCancel={() => setCropSource(null)} onSave={async cropped => {
      setPicture({ cropped, preview: URL.createObjectURL(cropped) });
      setCropSource(null);
    }} />}
  </>;
}
