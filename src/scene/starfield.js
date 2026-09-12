import * as THREE from "three";
import { makeGlowTexture } from "../textures.js";
import { TIER } from "../config.js";

export function buildStarfield(radius = 2200) {
  const positions = new Float32Array(TIER.starCount * 3);
  for (let i = 0; i < TIER.starCount; i++) {
    // Uniform distribution on a sphere shell.
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * (0.6 + Math.random() * 0.4);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const tex = makeGlowTexture({ inner: "rgba(255,255,255,1)", outer: "rgba(255,255,255,0)" });
  const mat = new THREE.PointsMaterial({
    size: 4,
    map: tex,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: false,
  });
  return new THREE.Points(geo, mat);
}
