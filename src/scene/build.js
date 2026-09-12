import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { SUN, PLANETS } from "../data/bodies.js";
import { getHelioPositionAU, getMoonOffsetAU, makeTime } from "../astro.js";
import { loadPlanetTexture, loadRingTexture, loadMoonDayNightTextures, makeGlowTexture, makeRingTexture } from "../textures.js";
import { TEXTURE_URLS } from "../assets/textures/index.js";
import { createEarthMaterial } from "./earthMaterial.js";
import { eclipticToScene } from "../coords.js";
import { TIER } from "../config.js";

function makeLabel(text, className) {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  return new CSS2DObject(el);
}

function ringGeometry(inner, outer, segments) {
  // Standard RingGeometry has radial UVs that don't map well to a texture
  // strip; remap so the ring texture reads cleanly from inner to outer edge.
  const geo = new THREE.RingGeometry(inner, outer, segments, 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const dist = v.length();
    const t = (dist - inner) / (outer - inner);
    uv.setXY(i, t, 0.5);
  }
  return geo;
}

const BLACK_1X1 = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
BLACK_1X1.needsUpdate = true;

/**
 * Builds the whole solar system into `root`. Returns handles the animation
 * loop needs to update positions/rotations every frame, plus helpers to
 * rebuild scale-dependent geometry (orbit paths, distances) when the user
 * toggles storybook <-> true scale.
 */
export function buildScene(root, { scaleMode }) {
  const planetObjects = [];

  // --- Sun -----------------------------------------------------------
  const sunGroup = new THREE.Group();
  const sunGeo = new THREE.SphereGeometry(1, TIER.sphereSegments, TIER.sphereSegments);
  const sunMat = new THREE.MeshBasicMaterial({ map: loadPlanetTexture(TEXTURE_URLS.sun) });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunGroup.add(sunMesh);

  const glowTex = makeGlowTexture({ inner: "rgba(255,214,140,0.9)", outer: "rgba(255,140,0,0)" });
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const glowSprite = new THREE.Sprite(glowMat);
  sunGroup.add(glowSprite);

  const sunLabel = makeLabel("Sun", "body-label body-label--sun");
  sunGroup.add(sunLabel);

  const sunLight = new THREE.PointLight(0xfff2d8, 1.9, 0, 0);
  sunGroup.add(sunLight);
  root.add(new THREE.AmbientLight(0x404050, 0.14));
  root.add(sunGroup);

  // --- Planets ---------------------------------------------------------
  for (const p of PLANETS) {
    const orbitPivot = new THREE.Group(); // positioned each frame from ephemeris
    const tiltGroup = new THREE.Group(); // real orientation (tilt + spin phase) applied per-frame in main.js

    const geo = new THREE.SphereGeometry(1, TIER.sphereSegments, TIER.sphereSegments);
    const isEarth = p.textureKey === "earth";
    let earthMaterial = null;
    let mat;
    if (isEarth) {
      earthMaterial = createEarthMaterial(loadPlanetTexture(TEXTURE_URLS.earthDay), loadPlanetTexture(TEXTURE_URLS.earthNight));
      mat = earthMaterial;
    } else {
      mat = new THREE.MeshStandardMaterial({ map: loadPlanetTexture(TEXTURE_URLS[p.textureKey]), roughness: 0.88, metalness: 0.04 });
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = TIER.shadows;
    mesh.receiveShadow = TIER.shadows;
    tiltGroup.add(mesh);

    // Earth's real cloud layer — a thin translucent shell just above the
    // surface, lit by the normal scene light (not the custom day/night
    // shader), so it naturally dims a bit on the night side.
    if (isEarth) {
      const cloudGeo = new THREE.SphereGeometry(1.008, TIER.sphereSegments, TIER.sphereSegments);
      const cloudTex = loadPlanetTexture(TEXTURE_URLS.earthClouds);
      const cloudMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        alphaMap: cloudTex,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        roughness: 1,
      });
      const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
      mesh.add(cloudMesh);
    }

    // "You are here" pin — Earth only. Parented to the mesh itself so it
    // inherits the true rotation (and current scale) automatically; its
    // position (on the unit sphere, just above the surface) and lit/dark
    // color are set each frame in main.js once we know the real lat/lon.
    let locationPin = null;
    if (isEarth) {
      const pinGroup = new THREE.Group();
      pinGroup.visible = false;
      const pinMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xffd23f })
      );
      pinGroup.add(pinMesh);
      const pinLabel = makeLabel("You are here", "body-label body-label--pin");
      pinLabel.position.set(0, 0.12, 0);
      pinGroup.add(pinLabel);
      mesh.add(pinGroup);
      locationPin = { group: pinGroup, mesh: pinMesh, label: pinLabel };
    }

    let ringMesh = null;
    if (p.rings) {
      const ringTex = p.rings.real ? loadRingTexture(TEXTURE_URLS.saturnRingAlpha) : makeRingTexture(p.rings.color, p.rings.opacity);
      const ringMat = new THREE.MeshBasicMaterial({
        map: ringTex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: p.rings.opacity,
      });
      const geoRing = ringGeometry(p.rings.innerRadiusRatio, p.rings.outerRadiusRatio, TIER.ringSegments);
      ringMesh = new THREE.Mesh(geoRing, ringMat);
      ringMesh.rotation.x = Math.PI / 2 - 0.15;
      tiltGroup.add(ringMesh);
    }

    orbitPivot.add(tiltGroup);

    const label = makeLabel(p.name, "body-label");
    orbitPivot.add(label);

    // Orbit path line — sampled once from real ephemeris, rescaled on toggle.
    const orbitLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x557799, transparent: true, opacity: 0.35 })
    );
    root.add(orbitLine);

    root.add(orbitPivot);

    let moon = null;
    if (p.moon) {
      const moonGroup = new THREE.Group();
      const moonGeo = new THREE.SphereGeometry(1, Math.max(12, TIER.sphereSegments / 2), Math.max(12, TIER.sphereSegments / 2));
      const moonMaterial = createEarthMaterial(BLACK_1X1, BLACK_1X1); // day/night swapped in once the real photo loads
      const moonDay = loadMoonDayNightTextures(TEXTURE_URLS.moon, (nightTex) => {
        moonMaterial.uniforms.nightTexture.value = nightTex;
      });
      moonMaterial.uniforms.dayTexture.value = moonDay;
      const moonMesh = new THREE.Mesh(moonGeo, moonMaterial);
      moonGroup.add(moonMesh);
      const moonLabel = makeLabel(p.moon.name, "body-label body-label--minor");
      moonGroup.add(moonLabel);
      orbitPivot.add(moonGroup);
      moon = { data: p.moon, mesh: moonMesh, group: moonGroup, label: moonLabel, dayNightMaterial: moonMaterial };
    }

    planetObjects.push({
      data: p,
      orbitPivot,
      tiltGroup,
      mesh,
      earthMaterial,
      locationPin,
      ringMesh,
      label,
      orbitLine,
      moon,
      orbitSampleAU: sampleOrbitAU(p),
    });
  }

  return { sunGroup, sunMesh, sunLabel, planetObjects };
}

/** Sample one full real orbit from ephemeris (cheap, done once at startup). */
function sampleOrbitAU(planet, steps = 180) {
  const pts = [];
  const now = new Date();
  for (let i = 0; i <= steps; i++) {
    const t = new Date(now.getTime() + (i / steps) * planet.orbitalPeriodDays * 86400000);
    pts.push(getHelioPositionAU(planet.body, makeTime(t)));
  }
  return pts;
}

export function rescaleOrbitLine(planetObj, scaleMode) {
  const pts = planetObj.orbitSampleAU.map((pt) => {
    const auDist = Math.hypot(pt.x, pt.y, pt.z) || 1e-6;
    const scaled = scaleMode.distanceFn(auDist) / auDist;
    return eclipticToScene(pt).multiplyScalar(scaled);
  });
  planetObj.orbitLine.geometry.dispose();
  planetObj.orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
}

export function updateBodySizes(handles, scaleMode) {
  const { sunGroup, sunMesh, planetObjects } = handles;
  sunMesh.scale.setScalar(scaleMode.sunRadius);
  sunGroup.userData.glowScale = scaleMode.sunRadius * 3;

  for (const obj of planetObjects) {
    const earthRadii = obj.data.radiusKm / 6371;
    const r = scaleMode.radiusFn(earthRadii);
    obj.mesh.scale.setScalar(r);
    if (obj.ringMesh) obj.ringMesh.scale.setScalar(r);
    obj.label.position.set(0, r + 0.4, 0);

    if (obj.moon) {
      const moonEarthRadii = obj.moon.data.radiusKm / 6371;
      const moonR = Math.max(0.12, scaleMode.radiusFn(moonEarthRadii) * 0.6);
      obj.moon.mesh.scale.setScalar(moonR);
      obj.moon.group.userData.visualOrbitRadius = r * 2.5 + 0.6;
      obj.moon.label.position.set(0, moonR + 0.15, 0);
    }
  }
}

export { PLANETS, sampleOrbitAU };
