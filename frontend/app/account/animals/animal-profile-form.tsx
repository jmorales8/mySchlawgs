import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api } from "../../components/api";
import CatalogInput from "./catalog-input";
import styles from "./profiles.module.css";

export type Animal = { id: string; name: string; animalType: string; breed: string; age: number; ageUnit: string; funFact: string; profilePhotoUrl: string | null };
type Draft = Omit<Animal, "id" | "age" | "profilePhotoUrl"> & { age: string };
const empty: Draft = { name: "", animalType: "Dog", breed: "", age: "", ageUnit: "years", funFact: "" };

export default function AnimalProfileForm({ animal, busy, onBusyChange, onSaved, onCancel, submitLabel = "Create profile", extraFields, funFactRows = 4 }: {
  animal?: Animal;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onSaved: (animal: Animal) => void;
  onCancel: () => void;
  submitLabel?: string;
  extraFields?: ReactNode;
  funFactRows?: number;
}) {
  const [draft, setDraft] = useState<Draft>(() => animal ? { ...animal, age: String(animal.age) } : empty);
  const [error, setError] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => { nameInput.current?.focus(); }, []);

  function field(key: keyof Draft, value: string) {
    setDraft(current => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    onBusyChange(true);
    setError("");
    try {
      const saved = await api<Animal>(`/api/account/animals${animal ? `/${animal.id}` : ""}`, {
        method: animal ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, age: Number(draft.age) }),
      });
      onSaved(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      onBusyChange(false);
    }
  }

  return <form onSubmit={save}><fieldset disabled={busy} className={styles.fields}>
        <label>Name <input ref={nameInput} required maxLength={60} value={draft.name} onChange={e => field("name", e.target.value)} placeholder="e.g. Biscuit" /></label>
        <CatalogInput label="Animal type" kind="type" required maxLength={60} value={draft.animalType} onChange={value => { field("animalType", value); field("breed", ""); }} placeholder="e.g. Dog, cat, rabbit" />
        <CatalogInput key={draft.animalType} label="Breed or mix" hint="Optional · mixed or unknown is welcome" kind="breed" animalType={draft.animalType} maxLength={100} value={draft.breed} onChange={value => field("breed", value)} placeholder="e.g. Golden retriever mix" />
        <div><span className={styles.ageLabel}>Age</span><div className={styles.age}><label><span className={styles.hint}>Amount</span><input required aria-label="Age amount" type="number" min={0} max={200} step={1} value={draft.age} onChange={e => field("age", e.target.value)} placeholder="e.g. 3" /></label><label><span className={styles.hint}>Unit</span><select aria-label="Age unit" value={draft.ageUnit} onChange={e => field("ageUnit", e.target.value)}><option value="years">Years</option><option value="months">Months</option></select></label></div></div>
        <label className={styles.wide}>Fun fact <span className={styles.hint}>Optional · a favorite habit, hidden talent, or silly obsession</span><textarea rows={funFactRows} maxLength={1000} value={draft.funFact} onChange={e => field("funFact", e.target.value)} placeholder="Thinks every delivery is a personal visit." /><span className={styles.hint}>{draft.funFact.length}/1,000</span></label>
        {extraFields}
        <div className={styles.actions}><button type="submit">{busy ? "Saving…" : animal ? "Save changes" : submitLabel}</button><button type="button" className={styles.secondary} onClick={onCancel}>Cancel</button></div>
      </fieldset>{error && <p role="alert" className={styles.error}>{error}</p>}</form>;
}
