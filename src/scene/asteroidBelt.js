import * as THREE from "three";
import { makeGlowTexture } from "../textures.js";
import { TIER } from "../config.js";

const INNER_AU = 2.1;
const OUTER_AU = 3.3;

export function buildAsteroidBelt(scaleMode) {
  const tex = makeGlowTexture({ inner: "rgba(210,200,190,1)", outer: "rgba(210,200,190,0)" });
  const mat = new THREE.PointsMaterial({
    size: 0.25,
    map: tex,
    transparent: true,
    depthWrite: false,
    color: 0xbdb3a4,
  });
  const points = new THREE.Points(new THREE.BufferGeometry(), mat);
  fillAsteroidBelt(points, scaleMode);
  return points;
}

export function fillAsteroidBelt(points, scaleMode) {
  const n = TIER.asteroidCount;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const au = INNER_AU + Math.random() * (OUTER_AU - INNER_AU);
    const angle = Math.random() * Math.PI * 2;
    const scaled = scaleMode.distanceFn(au);
    const wobble = (Math.random() - 0.5) * scaled * 0.03;
    positions[i * 3] = Math.cos(angle) * scaled;
    positions[i * 3 + 1] = wobble;
    positions[i * 3 + 2] = Math.sin(angle) * scaled;
  }
  points.geometry.dispose();
  points.geometry = new THREE.BufferGeometry();
  points.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
}
