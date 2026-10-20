export function cropBounds(width: number, height: number, zoom: number, x: number, y: number) {
  const size = Math.min(width, height) / zoom;
  const left = Math.max(0, Math.min(width - size, x - size / 2));
  const top = Math.max(0, Math.min(height - size, y - size / 2));
  return { left, top, size, x: left + size / 2, y: top + size / 2 };
}
