import { SCALE_MODES } from "./config.js";

const TRUE = SCALE_MODES.true;

/** Lays every planet out in a single row at true relative size, sorted smallest to largest, centered on x=0. */
export function layoutSizeCompareRow(planetObjects, { gap = 1.4 } = {}) {
  const items = planetObjects.map((obj) => ({ obj, r: TRUE.radiusFn(obj.data.radiusKm / 6371) }));
  items.sort((a, b) => a.r - b.r);

  let x = 0;
  const laidOut = [];
  for (const item of items) {
    x += item.r;
    laidOut.push({ ...item, x });
    x += item.r + gap;
  }
  const totalWidth = x - gap;
  const offset = totalWidth / 2;
  for (const item of laidOut) item.x -= offset;
  return { items: laidOut, totalWidth };
}

export const SUN_COMPARE_RADIUS = TRUE.sunRadius; // already calibrated close to the true 109-Earth-radii ratio
