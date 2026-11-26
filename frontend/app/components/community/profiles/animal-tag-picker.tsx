"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../../api";
import styles from "../post-composer.module.css";

export type AnimalOption = { id: string; name: string; animalType: string; profilePhotoUrl: string | null };
type TagPage = { items: (AnimalOption & { username: string })[]; nextOffset: number | null };

export default function AnimalTagPicker({ userId, selected, disabled, onSelect, onCreate }: {
  userId: string;
  selected: AnimalOption[];
  disabled: boolean;
  onSelect: (animal: AnimalOption) => void;
  onCreate: () => void;
}) {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const path = `/api/account/animals/tag-options?${new URLSearchParams({ q: term })}`;
  const query = useInfiniteQuery({
    queryKey: ["api", userId, path],
    initialPageParam: 0,
    queryFn: ({ signal, pageParam }) => api<TagPage>(
      `${path}&offset=${pageParam}`, { signal }),
    getNextPageParam: page => page.nextOffset ?? undefined,
    retry: false,
  });
  const waiting = term !== search.trim() || query.isPending;
  const items = [...new Map(query.data?.pages.flatMap(page => page.items.map(animal => [animal.id, animal] as const))).values()];

  return <div className={styles.animalPickerMenu} role="group" aria-label="Tag a schlawg">
    <label>Search schlawgs
      <input type="search" maxLength={100} placeholder="Name or @username" value={search} disabled={disabled}
        onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} />
    </label>
    {waiting ? <p role="status">Loading schlawgs…</p> : <>
      {items.length > 0 && <div className={styles.animalPickerResults} role="group" aria-label="Matching schlawgs">
        {items.map(animal => {
          const added = selected.some(item => item.id === animal.id);
          return <button key={animal.id} type="button" disabled={disabled} aria-disabled={added || undefined}
            onClick={() => { if (!added) onSelect(animal); }}>
            {animal.profilePhotoUrl ? <img src={animal.profilePhotoUrl} alt="" loading="lazy" /> : <span aria-hidden="true" className={styles.animalInitial}>{animal.name.slice(0, 1).toUpperCase()}</span>}
            <span>{animal.name}<small>{animal.animalType} · @{animal.username}</small></span>
            {added && <span className={styles.animalAdded}>Added</span>}
          </button>;
        })}
        {query.hasNextPage && <button type="button" disabled={disabled || query.isFetching}
          onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading more…" : query.isFetchNextPageError ? "Retry loading more" : "Show more schlawgs"}</button>}
      </div>}
      {query.isError && <p role="status">{query.error.message}</p>}
      {query.isError && !items.length && <button type="button" onClick={() => void query.refetch()}>Try again</button>}
      {!query.isError && !items.length && <p role="status">{term ? "No schlawgs match your search." : "No schlawg profiles yet."}</p>}
    </>}
    <button type="button" disabled={disabled} aria-haspopup="dialog" onClick={onCreate}>+ Create a schlawg profile</button>
  </div>;
}
