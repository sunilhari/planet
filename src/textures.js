import * as THREE from "three";

const loader = new THREE.TextureLoader();

/** Loads a real planetary texture image (color map). */
export function loadPlanetTexture(url) {
  const tex = loader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Loads Saturn's real ring image (has its own alpha channel for the gaps). */
export function loadRingTexture(url) {
  const tex = loader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * The Moon has no atmosphere and no city lights, so its "night" texture is
 * just its real day photo, darkened — this waits for the real image to
 * finish loading (so we have real pixels to darken) and reports the result
 * via `onReady` since that can't happen synchronously.
 */
export function loadMoonDayNightTextures(url, onReady) {
  const day = loader.load(url, (loadedTex) => {
    const img = loadedTex.image;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle = "rgba(0,0,0,0.86)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const night = new THREE.CanvasTexture(canvas);
    night.colorSpace = THREE.SRGBColorSpace;
    onReady(night);
  });
  day.colorSpace = THREE.SRGBColorSpace;
  return day;
}

function hex(colorInt) {
  return "#" + colorInt.toString(16).padStart(6, "0");
}

/** Soft radial dot — sun glow sprite, starfield points, comet glow. Procedural by nature, not a "planet". */
export function makeGlowTexture({ inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)", size = 128 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/** Procedural fallback ring texture — used for Uranus/Neptune, whose faint rings aren't in the real texture pack. */
export function makeRingTexture(colorInt, opacity = 0.8, { size = 256 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = 4;
  const ctx = canvas.getContext("2d");
  let s = 3;
  const rand = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
  const base = new THREE.Color(colorInt);
  for (let x = 0; x < size; x++) {
    const a = opacity * (0.3 + rand() * 0.7) * (0.5 + 0.5 * Math.sin(x * 0.15));
    const c = base.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.2);
    ctx.fillStyle = c.getStyle();
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.fillRect(x, 0, 1, 4);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export { hex };
