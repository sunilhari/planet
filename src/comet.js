import * as THREE from "three";
import { eclipticToScene } from "./coords.js";
import { makeGlowTexture } from "./textures.js";

const DEG2RAD = Math.PI / 180;

// Halley's Comet — real orbital elements (J2000-ish epoch), simplified
// two-body Kepler propagation. Good enough for "look, that orbit is wildly
// different" visual teaching, not for precision ephemeris.
const HALLEY = {
  a: 17.834, // AU, semi-major axis
  e: 0.96714,
  incDeg: 162.26,
  nodeDeg: 58.42, // longitude of ascending node
  argPeriDeg: 111.33, // argument of periapsis
  periapsisDate: Date.UTC(1986, 1, 9), // last perihelion, 1986-02-09
};
HALLEY.periodDays = Math.pow(HALLEY.a, 1.5) * 365.25; // Kepler's third law

function solveKepler(M, e) {
  let E = M;
  for (let i = 0; i < 60; i++) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

/** Heliocentric ecliptic position (AU) for Halley's comet at a given date. */
export function getHalleyPositionAU(date) {
  const { a, e, incDeg, nodeDeg, argPeriDeg, periapsisDate, periodDays } = HALLEY;
  const daysSincePeri = (date.getTime() - periapsisDate) / 86400000;
  const n = (2 * Math.PI) / periodDays; // mean motion
  const M = (((n * daysSincePeri) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const E = solveKepler(M, e);
  const trueAnomaly = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));

  const xOrb = r * Math.cos(trueAnomaly);
  const yOrb = r * Math.sin(trueAnomaly);

  const inc = incDeg * DEG2RAD;
  const node = nodeDeg * DEG2RAD;
  const argPeri = argPeriDeg * DEG2RAD;

  // Rotate: argument of periapsis -> inclination -> ascending node.
  const cosArg = Math.cos(argPeri), sinArg = Math.sin(argPeri);
  const x1 = xOrb * cosArg - yOrb * sinArg;
  const y1 = xOrb * sinArg + yOrb * cosArg;

  const cosInc = Math.cos(inc), sinInc = Math.sin(inc);
  const x2 = x1;
  const y2 = y1 * cosInc;
  const z2 = y1 * sinInc;

  const cosNode = Math.cos(node), sinNode = Math.sin(node);
  const x = x2 * cosNode - y2 * sinNode;
  const y = x2 * sinNode + y2 * cosNode;
  const z = z2;

  return { x, y, z, r };
}

export function buildComet(scaleMode) {
  const group = new THREE.Group();

  const coreTex = makeGlowTexture({ inner: "rgba(220,240,255,1)", outer: "rgba(150,200,255,0)" });
  const coreMat = new THREE.SpriteMaterial({ map: coreTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const core = new THREE.Sprite(coreMat);
  core.scale.setScalar(0.9);
  group.add(core);

  const tailTex = makeGlowTexture({ inner: "rgba(180,220,255,0.8)", outer: "rgba(180,220,255,0)" });
  const tailMat = new THREE.SpriteMaterial({ map: tailTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const tail = new THREE.Sprite(tailMat);
  group.add(tail);

  const orbitLine = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x88bfff, transparent: true, opacity: 0.3 })
  );

  rescaleCometOrbit(orbitLine, scaleMode);

  return { group, core, tail, orbitLine };
}

export function rescaleCometOrbit(orbitLine, scaleMode, steps = 240) {
  const pts = [];
  const now = new Date();
  for (let i = 0; i <= steps; i++) {
    const t = new Date(now.getTime() + (i / steps) * HALLEY.periodDays * 86400000);
    const pos = getHalleyPositionAU(t);
    const scaled = scaleMode.distanceFn(pos.r) / (pos.r || 1e-6);
    pts.push(eclipticToScene(pos).multiplyScalar(scaled));
  }
  orbitLine.geometry.dispose();
  orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
}

/** Updates the comet's scene position/visual size for the given date + scale mode. Returns AU distance from Sun. */
export function updateComet(comet, date, scaleMode) {
  const pos = getHalleyPositionAU(date);
  const scaled = scaleMode.distanceFn(pos.r) / (pos.r || 1e-6);
  eclipticToScene(pos, comet.group.position).multiplyScalar(scaled);

  // Closer to the Sun = brighter core and longer tail, tail pointing away from the Sun.
  const proximity = Math.max(0, Math.min(1, 1 - pos.r / 5));
  const coreScale = 0.25 + proximity * 0.9;
  comet.core.scale.setScalar(coreScale);

  const sunDir = comet.group.position.clone().normalize();
  const tailLength = 0.6 + proximity * 4.5;
  comet.tail.scale.set(coreScale * 0.6, tailLength, 1);
  comet.tail.position.copy(sunDir).multiplyScalar(-tailLength * 0.45);
  comet.tail.material.opacity = 0.15 + proximity * 0.6;

  return pos.r;
}
