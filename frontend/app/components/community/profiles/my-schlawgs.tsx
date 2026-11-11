"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { api } from "../../api";
import NotificationBell from "../../notifications/notification-bell";
import styles from "./my-schlawgs.module.css";
import sharedStyles from "../community.module.css";
import SchlawgProfileDialog from "./schlawg-profile-dialog";
import HoverLetters from "./hover-letters";

type Animal = { id: string; name: string; animalType: string; breed: string; funFact: string; profilePhotoUrl: string | null };
const gardenAnimals = ["🐶", "🐱", "🐰", "🐹", "🐭", "🐦", "🐠", "🐢", "🦎", "🐸", "🐴", "🐮", "🐷", "🐥", "🦊", "🦉", "🦦", "🦔", "🦜", "🦋", "🐌"];

function randomGardenAnimals() {
  const shuffled = [...gardenAnimals];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, 6);
}

function SchlawgGardenLoading() {
  const [typedAnimals, setTypedAnimals] = useState<string[]>([]);
  useEffect(() => {
    let sequence = randomGardenAnimals();
    let visibleCount = 0;
    let erasing = false;
    let timer = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const typeNext = () => {
      if (reducedMotion) {
        setTypedAnimals(sequence);
        return;
      }
      if (erasing) {
        visibleCount--;
        setTypedAnimals(sequence.slice(0, visibleCount));
        if (visibleCount === 0) {
          erasing = false;
          sequence = randomGardenAnimals();
          timer = window.setTimeout(typeNext, 350);
          return;
        }
      } else {
        visibleCount++;
        setTypedAnimals(sequence.slice(0, visibleCount));
        if (visibleCount === sequence.length) {
          erasing = true;
          timer = window.setTimeout(typeNext, 950);
          return;
        }
      }
      timer = window.setTimeout(typeNext, erasing ? 100 : 170);
    };
    timer = window.setTimeout(typeNext, reducedMotion ? 0 : 120);
    return () => window.clearTimeout(timer);
  }, []);

  return <p className={styles.gardenLoading} role="status" aria-label="Growing your schlawg garden">
    <span className={sharedStyles.srOnly}>Loading your schlawg garden</span>
    <span className={styles.gardenEmojiRow} aria-hidden="true">
      {typedAnimals.map((emoji, index) => <span key={`${index}-${emoji}`} className={styles.gardenEmoji}>{emoji}</span>)}
      <span className={styles.gardenCursor} />
    </span>
  </p>;
}

export default function MySchlawgs() {
  const [animals, setAnimals] = useState<Animal[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null);
  const heading = useId();
  useEffect(() => {
    let active = true;
    api<Animal[]>("/api/account/animals").then(items => { if (active) { setAnimals(items); setError(""); } })
      .catch(() => { if (active) setError("Couldn’t load your schlawgs."); });
    return () => { active = false; };
  }, [attempt]);
  const pages = Math.ceil((animals?.length ?? 0) / 5);
  const visibleAnimals = animals?.slice(page * 5, page * 5 + 5) ?? [];
  return <section className={styles.mySchlawgs} aria-labelledby={heading}>
    <div className={styles.schlawgsHeading}>
      <div>
        <h2 id={heading}><Link className={styles.gardenLink} href="/account/animals" aria-label="Da Schlawg Garden — View all & add schlawgs">
          <HoverLetters text="Da Schlawg Garden" />
          <span className={styles.gardenArrow} aria-hidden="true">↗</span>
        </Link></h2>
        <p className={styles.gardenHint}><Link className={styles.gardenLink} href="/account/animals" aria-label="View all & add schlawgs"><HoverLetters text="View all & add schlawgs" /></Link></p>
      </div>
      <NotificationBell onOpen={() => {}} onClose={() => {}} />
    </div>
    {error ? <p role="alert">{error} <button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></p>
      : !animals ? <SchlawgGardenLoading />
      : !animals.length ? <Link className={styles.schlawgsEmpty} href="/account/animals#new">you dont have any schlawgs :c lets get started :3 <span aria-hidden="true">→</span></Link>
      : <>
        <ul className={styles.schlawgsList}>{visibleAnimals.map((animal, index) => <li key={animal.id} style={{ left: `${(index / visibleAnimals.length) * 100}%`, width: `${100 / visibleAnimals.length}%` }}><button type="button" className={styles.schlawgTrigger} aria-haspopup="dialog" aria-label={`View ${animal.name}'s profile`} onClick={() => setSelectedAnimal(animal)}>
          {animal.profilePhotoUrl ? <img src={animal.profilePhotoUrl} alt="" width={64} height={64} /> : <span className={styles.schlawgInitial} aria-hidden="true">{animal.name.slice(0, 1).toUpperCase()}</span>}
          <span>{animal.name}</span>
        </button></li>)}</ul>
        {pages > 1 && <div className={styles.schlawgsActions}>
          <div role="group" aria-label="Browse your schlawgs"><button type="button" aria-label="Previous five schlawgs" disabled={page === 0} onClick={() => setPage(value => value - 1)}>←</button><span role="status">{page + 1} / {pages}</span><button type="button" aria-label="Next five schlawgs" disabled={page + 1 >= pages} onClick={() => setPage(value => value + 1)}>→</button></div>
        </div>}
      </>}
    {selectedAnimal && <SchlawgProfileDialog animal={selectedAnimal} onClose={() => setSelectedAnimal(null)} />}
  </section>;
}
