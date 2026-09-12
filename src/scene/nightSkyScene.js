import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { STARS, CONSTELLATION_LINES, computeStarHorizonPositions, altAzToDirection } from "../nightSky.js";
import { makeGlowTexture } from "../textures.js";

export const DOME_RADIUS = 70;

const nameToIndex = new Map(STARS.map((s, i) => [s.name, i]));

export function buildNightSkyDome() {
  const group = new THREE.Group();
  group.visible = false;

  const starTex = makeGlowTexture({ inner: "rgba(255,255,255,1)", outer: "rgba(255,255,255,0)" });
  const positions = new Float32Array(STARS.length * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size: 2.4,
    map: starTex,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: false,
    color: 0xffffff,
  });
  const points = new THREE.Points(geo, mat);
  group.add(points);

  const lineMat = new THREE.LineBasicMaterial({ color: 0x6f9fff, transparent: true, opacity: 0.55 });
  const lines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMat);
  group.add(lines);

  // One label per constellation, parked on its first-listed (usually brightest) star.
  const labelObjs = [];
  const seenCon = new Set();
  for (const star of STARS) {
    if (seenCon.has(star.con)) continue;
    seenCon.add(star.con);
    const el = document.createElement("div");
    el.className = "body-label body-label--minor";
    el.textContent = star.con;
    const label = new CSS2DObject(el);
    group.add(label);
    labelObjs.push({ name: star.name, label });
  }

  return { group, points, lines, labelObjs };
}

/** Recomputes every star's real position for `date`/`lat`/`lon` — cheap enough to call every few seconds, not every frame. */
export function updateNightSkyDome(dome, date, lat, lon) {
  const withHorizon = computeStarHorizonPositions(date, lat, lon);
  const positions = dome.points.geometry.attributes.position.array;
  const dirs = new Array(withHorizon.length);

  for (let i = 0; i < withHorizon.length; i++) {
    const star = withHorizon[i];
    const dir = altAzToDirection(Math.max(star.altitude, -2), star.azimuth);
    dirs[i] = dir;
    positions[i * 3] = dir.x * DOME_RADIUS;
    positions[i * 3 + 1] = dir.y * DOME_RADIUS;
    positions[i * 3 + 2] = dir.z * DOME_RADIUS;
  }
  dome.points.geometry.attributes.position.needsUpdate = true;
  dome.points.geometry.computeBoundingSphere();

  const linePositions = [];
  for (const [a, b] of CONSTELLATION_LINES) {
    const ia = nameToIndex.get(a);
    const ib = nameToIndex.get(b);
    if (ia === undefined || ib === undefined) continue;
    const da = dirs[ia];
    const db = dirs[ib];
    linePositions.push(da.x * DOME_RADIUS, da.y * DOME_RADIUS, da.z * DOME_RADIUS);
    linePositions.push(db.x * DOME_RADIUS, db.y * DOME_RADIUS, db.z * DOME_RADIUS);
  }
  dome.lines.geometry.dispose();
  dome.lines.geometry = new THREE.BufferGeometry();
  dome.lines.geometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));

  for (const { name, label } of dome.labelObjs) {
    const idx = nameToIndex.get(name);
    if (idx === undefined) continue;
    const dir = dirs[idx];
    label.position.set(dir.x * DOME_RADIUS, dir.y * DOME_RADIUS, dir.z * DOME_RADIUS);
  }
}
