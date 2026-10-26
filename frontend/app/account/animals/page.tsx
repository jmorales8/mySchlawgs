"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useAccount } from "../../components/account-provider";
import { api } from "../../components/api";
import styles from "./profiles.module.css";
import CatalogInput from "./catalog-input";
import ProfileCropper from "../../components/photos/profile-cropper";

type Animal = { id: string; name: string; animalType: string; breed: string; age: number; ageUnit: string; funFact: string; profilePhotoUrl: string | null };
type Draft = Omit<Animal, "id" | "age" | "profilePhotoUrl"> & { age: string };
const empty: Draft = { name: "", animalType: "Dog", breed: "", age: "", ageUnit: "years", funFact: "" };

export default function AnimalProfilesPage() {
  const { user, ready, accountError } = useAccount();
  // Key the workspace to the account so drafts and profiles never carry between users.
  return <main className={styles.page}><nav><Link href="/">← Community</Link><span>My schlawgs</span></nav>
    {!ready ? <p role="status">Getting your account…</p> : accountError ? <p role="alert">{accountError}</p> : !user ? <section><h1>A little home for every schlawg.</h1><p>Log in to create profiles for all your animals.</p><Link href="/#account">Log in or create an account →</Link></section> : <Workspace key={user.id} />}
  </main>;
}

function Workspace() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState<Draft>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [photoSelection, setPhotoSelection] = useState<{ animal: Animal; file: File } | null>(null);
  useEffect(() => {
    let active = true;
    api<Animal[]>("/api/account/animals").then(items => { if (active) { setAnimals(items); setLoaded(true); setLoadError(""); } })
      .catch((e: Error) => { if (active) setLoadError(e.message); });
    return () => { active = false; };
  }, [attempt]);

  function begin(animal?: Animal) {
    setDraft(animal ? { ...animal, age: String(animal.age) } : { ...empty });
    setEditing(animal?.id ?? null); setOpen(true); setError(""); setNotice(""); setDeleting(null);
    requestAnimationFrame(() => document.getElementById("animal-name")?.focus());
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const animal = await api<Animal>(`/api/account/animals${editing ? `/${editing}` : ""}`, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, age: Number(draft.age) }) });
      setAnimals(items => editing ? items.map(item => item.id === editing ? animal : item) : [...items, animal]);
      setOpen(false); setNotice(`${animal.name}’s profile ${editing ? "updated" : "created"}.`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(animal: Animal) {
    setBusy(true); setError(""); setNotice("");
    try { await api(`/api/account/animals/${animal.id}`, { method: "DELETE" }); setAnimals(items => items.filter(item => item.id !== animal.id)); setDeleting(null); setNotice(`${animal.name}’s profile deleted.`); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function field(key: keyof Draft, value: string) { setDraft(current => ({ ...current, [key]: value })); }

  function choosePhoto(animal: Animal, file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setError("Choose a JPEG, PNG, GIF, or WebP profile picture up to 10 MB."); return;
    }
    setError(""); setNotice(""); setPhotoSelection({ animal, file });
  }
  async function savePhoto(file: File) {
    if (!photoSelection) return;
    setBusy(true);
    try {
      const data = new FormData(); data.append("file", file);
      const animal = await api<Animal>(`/api/account/animals/${photoSelection.animal.id}/photo`, { method: "POST", body: data });
      setAnimals(items => items.map(item => item.id === animal.id ? animal : item));
      setPhotoSelection(null); setNotice(`${animal.name}’s profile picture updated.`);
    } finally { setBusy(false); }
  }

  return <>
    {photoSelection && <ProfileCropper file={photoSelection.file} onCancel={() => setPhotoSelection(null)} onSave={savePhoto} />}
    <header className={styles.header}><div><p className={styles.eyebrow}>YOUR ANIMAL FAMILY</p><h1>My schlawgs</h1><p>Big personalities deserve their own profiles. Introduce every animal in your family.</p></div><button disabled={!loaded || busy} onClick={() => begin()}>+ Add a schlawg</button></header>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {loadError ? <p role="alert">{loadError} <button onClick={() => setAttempt(value => value + 1)}>Try again</button></p> : !loaded ? <p role="status">Loading your schlawgs…</p> : null}
    {open && <section className={styles.formSection} aria-labelledby="form-title"><h2 id="form-title">{editing ? "Edit schlawg profile" : "Introduce us to your schlawg!"}</h2><p>Start with the basics, then tell us what makes them special.</p>
      <form onSubmit={save}><fieldset disabled={busy} className={styles.fields}>
        <label>Name <input id="animal-name" required maxLength={60} value={draft.name} onChange={e => field("name", e.target.value)} placeholder="e.g. Biscuit" /></label>
        <CatalogInput label="Animal type" kind="type" required maxLength={60} value={draft.animalType} onChange={value => { field("animalType", value); field("breed", ""); }} placeholder="e.g. Dog, cat, rabbit" />
        <CatalogInput key={draft.animalType} label="Breed or mix" hint="Optional · mixed or unknown is welcome" kind="breed" animalType={draft.animalType} maxLength={100} value={draft.breed} onChange={value => field("breed", value)} placeholder="e.g. Golden retriever mix" />
        <div><span className={styles.ageLabel}>Age</span><div className={styles.age}><label><span className={styles.hint}>Amount</span><input required aria-label="Age amount" type="number" min={0} max={200} step={1} value={draft.age} onChange={e => field("age", e.target.value)} placeholder="e.g. 3" /></label><label><span className={styles.hint}>Unit</span><select aria-label="Age unit" value={draft.ageUnit} onChange={e => field("ageUnit", e.target.value)}><option value="years">Years</option><option value="months">Months</option></select></label></div></div>
        <label className={styles.wide}>Fun fact <span className={styles.hint}>Optional · a favorite habit, hidden talent, or silly obsession</span><textarea rows={4} maxLength={1000} value={draft.funFact} onChange={e => field("funFact", e.target.value)} placeholder="Thinks every delivery is a personal visit." /><span className={styles.hint}>{draft.funFact.length}/1,000</span></label>
        <div className={styles.actions}><button type="submit">{busy ? "Saving…" : editing ? "Save changes" : "Create profile"}</button><button type="button" className={styles.secondary} onClick={() => { setOpen(false); setError(""); }}>Cancel</button></div>
      </fieldset></form></section>}
    {loaded && animals.length === 0 && !open && <section className={styles.empty}><span aria-hidden="true">♡</span><h2>Your family starts here.</h2><p>Add your first schlawg, then make room for the whole crew.</p><button onClick={() => begin()}>Create your first profile</button></section>}
    <div className={styles.grid}>{animals.map(animal => <article className={styles.card} key={animal.id}>
      {animal.profilePhotoUrl ? <img className={styles.animalAvatar} src={animal.profilePhotoUrl} alt={`${animal.name}'s profile`} /> : <div className={styles.monogram} aria-hidden="true">{animal.name[0]?.toUpperCase()}</div>}
      <label className={styles.photoButton}>{animal.profilePhotoUrl ? "Change profile picture" : "Add profile picture"}<input aria-label={`${animal.profilePhotoUrl ? "Change" : "Add"} profile picture for ${animal.name}`} disabled={busy} type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={event => { choosePhoto(animal, event.target.files?.[0]); event.target.value = ""; }} /></label>
      <h2>{animal.name}</h2><p className={styles.eyebrow}>{animal.animalType}</p><dl><div><dt>Breed or mix</dt><dd>{animal.breed || "Not added yet"}</dd></div><div><dt>Age</dt><dd>{animal.age} {animal.age === 1 ? animal.ageUnit.slice(0, -1) : animal.ageUnit} old</dd></div></dl>{animal.funFact && <div className={styles.fact}><h3>Fun fact</h3><p>{animal.funFact}</p></div>}
      <div className={styles.actions}><button disabled={busy} className={styles.secondary} onClick={() => begin(animal)}>Edit profile</button><button disabled={busy} className={styles.delete} onClick={() => { setDeleting(animal.id); setError(""); }}>Delete</button></div>
      {deleting === animal.id && <div role="group" aria-label={`Delete ${animal.name}'s profile`}><p>Delete {animal.name}’s profile? This cannot be undone.</p><div className={styles.actions}><button disabled={busy} onClick={() => void remove(animal)}>{busy ? "Deleting…" : "Delete profile"}</button><button disabled={busy} className={styles.secondary} onClick={() => setDeleting(null)}>Keep profile</button></div></div>}
    </article>)}</div>
  </>;
}
