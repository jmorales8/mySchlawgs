let revision = 0;
export function invalidateFeeds() { revision++; }

/** In-memory, account-scoped entries; successful writes invalidate outstanding reads too. */
export class FeedCache<T> {
  private entries = new Map<string, { revision: number; expires: number; value?: T; pending?: Promise<T> }>();
  constructor(private ttl = 60_000) {}

  peek(key: string): T | undefined {
    const entry = this.entries.get(key);
    return entry && entry.revision === revision && entry.expires > Date.now() ? entry.value : undefined;
  }

  read(key: string, fetcher: () => Promise<T>, force = false): Promise<T> {
    const existing = this.entries.get(key);
    if (!force && existing?.revision === revision) {
      if (existing.pending) return existing.pending;
      if (existing.expires > Date.now()) return Promise.resolve(existing.value as T);
    }
    const entry: { revision: number; expires: number; value?: T; pending?: Promise<T> } = { revision, expires: 0 };
    this.entries.set(key, entry);
    entry.pending = fetcher().then(value => {
      entry.value = value;
      entry.expires = Date.now() + this.ttl;
      entry.pending = undefined;
      return value;
    }, error => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
      throw error;
    });
    return entry.pending;
  }
}
