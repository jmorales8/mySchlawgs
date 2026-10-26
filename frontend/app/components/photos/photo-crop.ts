export type Crop = { left: number; top: number; right: number; bottom: number };
export const fullCrop: Crop = { left: 0, top: 0, right: 1, bottom: 1 };
export function moveCrop(crop: Crop, handle: string, dx: number, dy: number): Crop {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  if (handle === "move") {
    dx = clamp(dx, -crop.left, 1 - crop.right); dy = clamp(dy, -crop.top, 1 - crop.bottom);
    return { left: crop.left + dx, right: crop.right + dx, top: crop.top + dy, bottom: crop.bottom + dy };
  }
  return {
    left: handle.includes("w") ? clamp(crop.left + dx, 0, crop.right - .05) : crop.left,
    right: handle.includes("e") ? clamp(crop.right + dx, crop.left + .05, 1) : crop.right,
    top: handle.includes("n") ? clamp(crop.top + dy, 0, crop.bottom - .05) : crop.top,
    bottom: handle.includes("s") ? clamp(crop.bottom + dy, crop.top + .05, 1) : crop.bottom,
  };
}
