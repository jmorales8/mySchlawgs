// Older uploads have no batch ID and remain individual posts.
export function groupPhotoBatches<T extends { id: string; batchId?: string | null; batchPosition?: number }>(photos: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const photo of photos) {
    const key = photo.batchId ?? photo.id;
    const group = groups.get(key);
    if (group) group.push(photo);
    else groups.set(key, [photo]);
  }
  return Array.from(groups.values(), group => group.sort((a, b) => (a.batchPosition ?? 0) - (b.batchPosition ?? 0)));
}
