"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api } from "../../components/api";
import styles from "./profiles.module.css";

export default function CatalogInput({ label, hint, kind, animalType = "", value, onChange, maxLength, required, placeholder }: {
  label: string; hint?: string; kind: "type" | "breed"; animalType?: string; value: string;
  onChange: (value: string) => void; maxLength: number; required?: boolean; placeholder: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ key: string; items: string[] } | null>(null);
  const [failure, setFailure] = useState("");
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const key = `${kind}:${animalType}:${query}`;
  const items = results?.key === key ? results.items : [];
  useEffect(() => {
    if (!open) return;
    let current = true;
    const timer = setTimeout(() => {
      api<string[]>(`/api/account/animals/suggestions?${new URLSearchParams({ kind, animalType, q: query })}`)
        .then(items => { if (current) { setResults({ key, items }); setFailure(""); } })
        .catch(() => { if (current) setFailure("Suggestions unavailable. You can still type your own."); });
    }, 150);
    return () => { current = false; clearTimeout(timer); };
  }, [open, kind, animalType, query, key]);
  useEffect(() => { root.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [active]);
  function choose(item: string) { onChange(item); setOpen(false); setActive(-1); }
  return <div ref={root} className={styles.catalog} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id}>{label}{hint && <span id={`${id}-hint`} className={styles.hint}>{hint}</span>}</label>
    <div className={styles.catalogAnchor}>
      <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-describedby={hint ? `${id}-hint` : undefined} aria-activedescendant={open && active >= 0 && items[active] ? `${id}-${active}` : undefined} autoComplete="off" required={required} maxLength={maxLength} value={value} placeholder={placeholder}
        onFocus={() => { setQuery(""); setActive(-1); setOpen(true); }}
        onClick={() => { if (!open) { setQuery(""); setActive(-1); setOpen(true); } }}
        onChange={event => { onChange(event.target.value); setQuery(event.target.value); setActive(-1); setFailure(""); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            setActive(index => items.length ? event.key === "ArrowDown" ? (index + 1) % items.length : (index <= 0 ? items.length - 1 : index - 1) : -1);
          } else if (event.key === "Enter" && open && active >= 0 && items[active]) { event.preventDefault(); choose(items[active]); }
          else if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        }} />
      {open && <div className={styles.catalogDropdown}>
        <ul role="listbox" id={`${id}-list`} aria-label={`${label} suggestions`}>{items.map((item, index) => <li role="option" aria-selected={active === index} id={`${id}-${index}`} key={item} onPointerDown={event => event.preventDefault()} onClick={() => choose(item)}>{item}</li>)}</ul>
        <p className={styles.catalogStatus} role="status">{failure || (results?.key !== key ? "Loading suggestions…" : !items.length ? "No matches. Type your own to add it when you save." : "Choose an option or type your own.")}</p>
      </div>}
    </div>
  </div>;
}
