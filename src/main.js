import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

import "./style.css";
import { TIER, SCALE_MODES, DEFAULT_SCALE_MODE, SPEED_PRESETS, DEFAULT_SPEED_INDEX, HORIZONS_CALIBRATION } from "./config.js";
import { SUN, PLANETS } from "./data/bodies.js";
import { buildScene, rescaleOrbitLine, updateBodySizes } from "./scene/build.js";
import { buildStarfield } from "./scene/starfield.js";
import { buildAsteroidBelt, fillAsteroidBelt } from "./scene/asteroidBelt.js";
import { buildControls, buildFocusOverlay, buildExplorePanel, buildToast, buildQuizHud } from "./ui/controls.js";
import { getHelioPositionAU, getMoonOffsetAU, makeTime, calibrateAgainstHorizons } from "./astro.js";
import { eclipticToScene } from "./coords.js";
import { getBodyOrientationQuaternion, latLonToBodyFixedVector } from "./orientation.js";
import { getUserLocation } from "./geo.js";
import { createFocusController } from "./focus.js";
import { getSeasonDates } from "./seasons.js";
import { getMoonPhaseInfo } from "./moonPhase.js";
import { layoutSizeCompareRow } from "./scaleCompare.js";
import { buildComet, updateComet, rescaleCometOrbit } from "./comet.js";
import { createTour } from "./tour.js";
import { setSoundEnabled, isSoundEnabled, playWhoosh } from "./audio.js";
import { getVisibleTonight } from "./whatsUpTonight.js";
import { connectRemote } from "./remoteClient.js";
import { speak, stopSpeaking, setReadAloudEnabled, isReadAloudEnabled } from "./speech.js";
import { QUIZ_CLUES, shuffledKeys } from "./quiz.js";
import { buildNightSkyDome, updateNightSkyDome, DOME_RADIUS } from "./scene/nightSkyScene.js";
import { APOLLO_SITES, MARS_ROVER_SITES } from "./data/landmarks.js";
import { buildLandmarkSet, buildLandmarkMarker, placeLandmark } from "./scene/landmarks.js";
import { fetchISSPosition } from "./iss.js";

const app = document.getElementById("app");
const STAR_RADIUS = 2200;

// --- Renderer / camera / scene ---------------------------------------
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 6000);

const renderer = new THREE.WebGLRenderer({ antialias: TIER.pixelRatioCap > 1 });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, TIER.pixelRatioCap));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = TIER.shadows;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
app.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.top = "0";
labelRenderer.domElement.style.left = "0";
labelRenderer.domElement.style.pointerEvents = "none";
app.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.15;
controls.minDistance = 0.3;
controls.maxDistance = 5000;

let composer = null;
if (TIER.bloom) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.4, 0.55);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

// --- Build the solar system -------------------------------------------
let scaleMode = SCALE_MODES[DEFAULT_SCALE_MODE];

const handles = buildScene(scene, { scaleMode });
updateBodySizes(handles, scaleMode);
for (const obj of handles.planetObjects) rescaleOrbitLine(obj, scaleMode);

const starfield = buildStarfield(STAR_RADIUS);
scene.add(starfield);

const asteroidBelt = buildAsteroidBelt(scaleMode);
scene.add(asteroidBelt);

const comet = buildComet(scaleMode);
scene.add(comet.group);
scene.add(comet.orbitLine);

const nightSkyDome = buildNightSkyDome();
scene.add(nightSkyDome.group);

fitCameraForScale(scaleMode, true);

function neptuneScaledDistance(mode) {
  return mode.distanceFn(30.07);
}

function fitCameraForScale(mode, isInitial = false) {
  const maxDist = neptuneScaledDistance(mode);
  camera.far = Math.max(maxDist * 4, STAR_RADIUS * 1.3);
  camera.updateProjectionMatrix();
  controls.maxDistance = maxDist * 6;

  const desiredDistance = maxDist * 1.15;
  const dir = isInitial
    ? new THREE.Vector3(0.35, 0.55, 1).normalize()
    : camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(dir.multiplyScalar(desiredDistance));
  controls.target.set(0, 0, 0);
  controls.update();
}

// --- Location pin (Earth only) -------------------------------------------
const earthObj = handles.planetObjects.find((obj) => obj.data.key === "earth");
let locationState = "pending"; // "pending" | "resolved" | "denied"
let userLocation = null;

if (earthObj?.locationPin) {
  getUserLocation().then((loc) => {
    if (!loc) {
      locationState = "denied";
      return;
    }
    locationState = "resolved";
    userLocation = loc;
    const vec = latLonToBodyFixedVector(loc.lat, loc.lon);
    earthObj.locationPin.bodyFixedVec = vec;
    earthObj.locationPin.group.position.copy(vec).multiplyScalar(1.045);
    earthObj.locationPin.group.visible = true;
  });
}

// --- Historic landing sites (Moon + Mars) -----------------------------------
const marsObj = handles.planetObjects.find((obj) => obj.data.key === "mars");
const apolloMarkers = earthObj?.moon ? buildLandmarkSet(APOLLO_SITES, earthObj.moon.mesh, 0xffd23f, "body-label--pin") : [];
const marsRoverMarkers = marsObj ? buildLandmarkSet(MARS_ROVER_SITES, marsObj.mesh, 0x7fe0a0, "body-label--pin") : [];

// --- ISS (Earth only, live position when online) ---------------------------
const issMarker = earthObj ? buildLandmarkMarker("ISS", 0x9ad4ff, "body-label--pin") : null;
if (issMarker) {
  issMarker.group.visible = false;
  earthObj.mesh.add(issMarker.group);
}
let issInfo = null;
let lastIssFetch = 0;

async function refreshIss() {
  const pos = await fetchISSPosition();
  if (!pos || !issMarker) return;
  issInfo = pos;
  placeLandmark(issMarker, earthObj.mesh, pos.lat, pos.lon, 1.15); // exaggerated altitude — true scale (~6% of Earth's radius) would be invisible
  issMarker.group.visible = true;
}

// --- Focus (full-screen) view ---------------------------------------------
const focus = createFocusController({ camera, controls });
const focusOverlay = buildFocusOverlay({ onExit: () => exitFocus() });
const toast = buildToast();

// mesh -> { info, obj, kind } where obj is a planetObj, its .moon, or null for the Sun
const meshToEntry = new Map();
const keyToEntry = new Map();
const pickableMeshes = [handles.sunMesh];

function colorHex(n) {
  return "#" + n.toString(16).padStart(6, "0");
}

meshToEntry.set(handles.sunMesh, {
  info: { name: SUN.name, funFact: SUN.funFact, color: colorHex(SUN.color), tempC: SUN.tempC },
  obj: null,
  kind: "sun",
});
keyToEntry.set("sun", meshToEntry.get(handles.sunMesh));

for (const obj of handles.planetObjects) {
  pickableMeshes.push(obj.mesh);
  const entry = {
    info: { name: obj.data.name, funFact: obj.data.funFact, color: colorHex(obj.data.color), tempC: obj.data.tempC },
    obj,
    kind: obj.data.key === "earth" ? "earth" : "planet",
  };
  meshToEntry.set(obj.mesh, entry);
  keyToEntry.set(obj.data.key, entry);

  if (obj.moon) {
    pickableMeshes.push(obj.moon.mesh);
    const moonEntry = {
      info: { name: obj.moon.data.name, funFact: obj.moon.data.funFact, color: "#dcdad2", tempC: obj.moon.data.tempC },
      obj: obj.moon,
      kind: "moon",
    };
    meshToEntry.set(obj.moon.mesh, moonEntry);
    keyToEntry.set("moon", moonEntry);
  }
}

for (const { marker, site } of [...apolloMarkers, ...marsRoverMarkers]) {
  pickableMeshes.push(marker.mesh);
  meshToEntry.set(marker.mesh, { info: { name: site.name, funFact: site.fact }, kind: "landmark" });
}
if (issMarker) {
  pickableMeshes.push(issMarker.mesh);
  meshToEntry.set(issMarker.mesh, {
    kind: "landmark",
    get info() {
      return {
        name: "ISS",
        funFact: issInfo
          ? `🛰️ The International Space Station — ${Math.round(issInfo.altitudeKm)} km up, going ${Math.round(issInfo.velocityKmh).toLocaleString()} km/h! It circles Earth about every 92 minutes.`
          : "🛰️ The International Space Station!",
      };
    },
  });
}

let activeEntry = null;
let lastPhaseUpdate = 0;

function entryKey(entry) {
  if (entry.kind === "sun") return "sun";
  if (entry.kind === "moon") return "moon";
  return entry.obj.data.key;
}

/** Hides every other planet (+ its orbit line), the asteroid belt, and the comet so the focused body reads as an isolated close-up instead of competing with whatever else happens to be nearby on screen — most noticeable once the remote's rotate/auto-spin can swing the camera toward another planet's real position. `exceptKey` is left alone (its own visibility is never forced), so the focused planet (and Earth's Moon, when either is the target) keeps rendering normally. */
function setOtherBodiesVisible(visible, exceptKey) {
  for (const obj of handles.planetObjects) {
    if (obj.data.key === exceptKey) continue;
    obj.orbitPivot.visible = visible;
    obj.orbitLine.visible = visible && ordersVisible;
  }
  asteroidBelt.visible = visible;
  comet.group.visible = visible;
  comet.orbitLine.visible = visible && ordersVisible;
}

function enterFocus(entry) {
  const mesh = entry.kind === "sun" ? handles.sunMesh : entry.obj.mesh;
  const hasRings = entry.kind === "planet" && !!entry.obj.data.rings;
  const distanceMultiplier = entry.kind === "sun" ? 3.2 : hasRings ? 4.2 : 2.3;
  activeEntry = entry;
  focus.focusOn(mesh, distanceMultiplier);
  focusOverlay.show(entry.info);
  controlsUI.setVisible(false);
  explorePanel.setVisible(false);
  if (!compareMode && !nightSkyActive) {
    const exceptKey = entry.kind === "moon" ? "earth" : entry.kind === "sun" ? null : entry.obj.data.key;
    setOtherBodiesVisible(false, exceptKey);
  }
  playWhoosh();
  speak(`${entry.info.name}. ${entry.info.funFact}`);
}

function exitFocus(immediate = false) {
  if (!focus.isActive) return;
  focus.exit(() => focusOverlay.hide(), immediate);
  activeEntry = null;
  if (autoSpin) {
    autoSpin = false;
    broadcastState();
  }
  rotateHoldDirH = 0;
  rotateHoldDirV = 0;
  controlsUI.setVisible(true);
  if (!compareMode && !nightSkyActive) setOtherBodiesVisible(true, null);
  if (!immediate) playWhoosh();
  stopSpeaking();
}

/** Shared by direct clicks and remote-control taps: a quiz in progress treats a pick as a guess, otherwise it opens the full-screen focus view. */
function selectEntry(entry) {
  if (quizActive) handleQuizGuess(entry);
  else enterFocus(entry);
}

// --- Manual rotate (drag-free, for remote control while projected) --------
const ROTATE_HOLD_SPEED = 1.1; // rad/sec while a remote rotate button is held
const AUTO_SPIN_SPEED = 0.22; // rad/sec for the hands-free auto-spin toggle (horizontal only)
const MIN_POLAR = 0.08; // radians of headroom kept above/below the poles so the view can't flip over
let rotateHoldDirH = 0; // -1 left, 0 idle, 1 right
let rotateHoldDirV = 0; // -1 down, 0 idle, 1 up
let autoSpin = false;
const _rotateOffset = new THREE.Vector3();
const _rotateSpherical = new THREE.Spherical();

function rotateView(deltaAzimuth, deltaPolar = 0) {
  _rotateOffset.copy(camera.position).sub(controls.target);
  _rotateSpherical.setFromVector3(_rotateOffset);
  _rotateSpherical.theta += deltaAzimuth;
  // Up on the remote should tilt the view up regardless of which pole the
  // camera is nearer, so subtract: polar angle is measured down from +Y.
  _rotateSpherical.phi = THREE.MathUtils.clamp(_rotateSpherical.phi - deltaPolar, MIN_POLAR, Math.PI - MIN_POLAR);
  _rotateOffset.setFromSpherical(_rotateSpherical);
  camera.position.copy(controls.target).add(_rotateOffset);
}

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
let pointerDownPos = null;

renderer.domElement.addEventListener("pointerdown", (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!pointerDownPos) return;
  const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  pointerDownPos = null;
  if (moved > 6) return; // was a drag, not a tap/click

  if (nightSkyActive) return; // nothing to click on in the star dome

  pointerNdc.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNdc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(pickableMeshes, false);
  if (hits.length) {
    const entry = meshToEntry.get(hits[0].object);
    if (entry) {
      if (entry.kind === "landmark") {
        toast.show(entry.info.funFact, 8000);
        speak(entry.info.funFact);
      } else selectEntry(entry);
    }
  } else if (focus.isActive) {
    exitFocus();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && focus.isActive) exitFocus();
});

// Any manual interaction pauses the ambient camera drift so it doesn't
// fight the person driving the projector.
renderer.domElement.addEventListener("pointerdown", () => (controls.autoRotate = false));

// Browsers require a real user gesture before audio can play — start the
// immersive space ambience on the very first tap/click so it's just there
// without anyone needing to dig into the Explore panel. Still toggleable off.
window.addEventListener(
  "pointerdown",
  () => {
    if (!isSoundEnabled()) {
      setSoundEnabled(true);
      explorePanel.setSoundLabel("Sound: On");
      broadcastState();
    }
  },
  { once: true }
);

// --- Mode bookkeeping -------------------------------------------------------
// Compare / night-sky / tour / quiz are mutually exclusive "takeover" modes;
// stopAllModes() is called before entering any of them so only one is ever
// active, without every entry point needing to know about every other mode.
let compareMode = false;
let nightSkyActive = false;
let quizActive = false;

function stopAllModes() {
  if (tour.isRunning) {
    tour.stop();
    explorePanel.setTourLabel("🎬 Start Tour");
  }
  if (compareMode) exitCompareMode();
  if (nightSkyActive) exitNightSky();
  if (quizActive) stopQuiz();
  if (focus.isActive) exitFocus(true);
}

// --- Scale-compare mode ("line up all the planets") -----------------------
function enterCompareMode() {
  compareMode = true;

  const { items, totalWidth } = layoutSizeCompareRow(handles.planetObjects);
  for (const { obj, x, r } of items) {
    obj.orbitPivot.position.set(x, 0, 0);
    obj.mesh.scale.setScalar(r);
    if (obj.ringMesh) obj.ringMesh.scale.setScalar(r);
    obj.label.position.set(0, r + 0.3, 0);
    obj.orbitLine.visible = false;
    if (obj.moon) obj.moon.group.visible = false;
  }
  setSunBodyVisible(false); // keep the group (and its light, which illuminates the lined-up planets) — hide only the visual Sun
  asteroidBelt.visible = false;
  comet.group.visible = false;
  comet.orbitLine.visible = false;

  const dist = totalWidth * 0.8;
  controls.autoRotate = false;
  const fromPos = camera.position.clone();
  const fromTarget = controls.target.clone();
  const toTarget = new THREE.Vector3(0, 0, 0);
  const toPos = new THREE.Vector3(0, totalWidth * 0.12, dist);
  tweenCamera(fromPos, toPos, fromTarget, toTarget);

  toast.show("All 8 planets, true size next to each other — see how tiny Mercury is next to Jupiter!", 7000);
}

function exitCompareMode() {
  compareMode = false;
  updateBodySizes(handles, scaleMode);
  for (const obj of handles.planetObjects) {
    obj.orbitLine.visible = ordersVisible;
    if (obj.moon) obj.moon.group.visible = true;
  }
  setSunBodyVisible(true);
  asteroidBelt.visible = true;
  comet.group.visible = true;
  comet.orbitLine.visible = ordersVisible;
  fitCameraForScale(scaleMode, false);
}

/** Toggles just the visible Sun sphere/glow/label — never the group, since its PointLight is the scene's only real light source and must stay on (e.g. so Compare Sizes' MeshStandardMaterial planets aren't left unlit). */
function setSunBodyVisible(visible) {
  handles.sunMesh.visible = visible;
  handles.sunLabel.visible = visible;
  const glow = handles.sunGroup.children.find((c) => c.isSprite);
  if (glow) glow.visible = visible;
}

let ordersVisible = true; // tracks the "Orbits: On/Off" toggle so compare mode can restore it correctly

function toggleCompare() {
  if (compareMode) {
    exitCompareMode();
    explorePanel.setCompareLabel("Line up all the planets");
    return;
  }
  stopAllModes();
  enterCompareMode();
  explorePanel.setCompareLabel("← Back to Solar System View");
}

// Small local tween helper shared by compare-mode and season framing (focus.js owns the close-up-follow version).
function tweenCamera(fromPos, toPos, fromTarget, toTarget, durationMs = 900) {
  const start = performance.now();
  controls.enabled = false;
  function step(now) {
    const t = Math.min(1, (now - start) / durationMs);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    camera.position.lerpVectors(fromPos, toPos, e);
    controls.target.lerpVectors(fromTarget, toTarget, e);
    if (t < 1) requestAnimationFrame(step);
    else controls.enabled = true;
  }
  requestAnimationFrame(step);
}

// --- Seasons ---------------------------------------------------------------
const seasonDates = getSeasonDates(new Date().getFullYear());

function jumpToSeason(key) {
  const season = seasonDates.find((s) => s.key === key);
  if (!season) return;
  stopAllModes();
  simTime = new Date(season.date);
  toast.show(`${season.label}: ${season.caption}`, 8000);
}

// --- Guided tour -------------------------------------------------------------
const tourSequence = [
  keyToEntry.get("sun"),
  ...PLANETS.map((p) => keyToEntry.get(p.key)),
  keyToEntry.get("moon"),
];

const tour = createTour({
  stepDurationMs: 9000,
  onStep: (entry) => enterFocus(entry),
  onEnd: () => {
    exitFocus();
    explorePanel.setTourLabel("🎬 Start Tour");
  },
});

function toggleTour() {
  if (tour.isRunning) {
    tour.stop();
    exitFocus(true);
    explorePanel.setTourLabel("🎬 Start Tour");
    return;
  }
  stopAllModes();
  explorePanel.setVisible(false);
  explorePanel.setTourLabel("⏹ Stop Tour");
  tour.start(tourSequence.filter(Boolean));
}

function toggleSound() {
  setSoundEnabled(!isSoundEnabled());
  explorePanel.setSoundLabel(`Sound: ${isSoundEnabled() ? "On" : "Off"}`);
  broadcastState();
}

function toggleReadAloud() {
  setReadAloudEnabled(!isReadAloudEnabled());
  explorePanel.setReadAloudLabel(`Read Aloud: ${isReadAloudEnabled() ? "On" : "Off"}`);
  broadcastState();
}

/** Pushes current toggle state to the phone remote so its buttons reflect reality — needed since the display can change state on its own (first-gesture sound autostart, a quiz/focus exit resetting auto-spin) without the remote ever tapping the button itself. */
function broadcastState() {
  remote.send({ type: "state", sound: isSoundEnabled(), readAloud: isReadAloudEnabled(), autoSpin });
}

// --- Night sky (real stars + constellations from your location) -----------
let lastNightSkyUpdate = 0;

function refreshNightSky() {
  const lat = userLocation?.lat ?? 40;
  const lon = userLocation?.lon ?? 0;
  updateNightSkyDome(nightSkyDome, simTime, lat, lon);
}

function enterNightSky() {
  nightSkyActive = true;
  handles.sunGroup.visible = false;
  for (const obj of handles.planetObjects) {
    obj.orbitPivot.visible = false;
    obj.orbitLine.visible = false;
  }
  asteroidBelt.visible = false;
  comet.group.visible = false;
  comet.orbitLine.visible = false;
  starfield.visible = false;

  refreshNightSky();
  lastNightSkyUpdate = performance.now();
  nightSkyDome.group.visible = true;

  controls.autoRotate = false;
  controls.minDistance = 2;
  controls.maxDistance = DOME_RADIUS * 1.3;
  tweenCamera(camera.position.clone(), new THREE.Vector3(0, 15, 40), controls.target.clone(), new THREE.Vector3(0, 0, 0));

  const locNote = userLocation ? "the sky above you right now" : "a typical sky (turn on location access for your real sky)";
  toast.show(`🌌 This is ${locNote}. Drag to look around and spot the constellations!`, 8000);
}

function exitNightSky() {
  nightSkyActive = false;
  nightSkyDome.group.visible = false;
  handles.sunGroup.visible = true;
  for (const obj of handles.planetObjects) {
    obj.orbitPivot.visible = true;
    obj.orbitLine.visible = ordersVisible;
  }
  asteroidBelt.visible = true;
  comet.group.visible = true;
  comet.orbitLine.visible = ordersVisible;
  starfield.visible = true;
  controls.minDistance = 0.3;
  fitCameraForScale(scaleMode, false);
}

function toggleNightSky() {
  if (nightSkyActive) {
    exitNightSky();
    explorePanel.setNightSkyLabel("Show tonight's sky");
    return;
  }
  stopAllModes();
  enterNightSky();
  explorePanel.setNightSkyLabel("← Back to Solar System");
}

// --- Quiz ("spot it") -------------------------------------------------------
const quizHud = buildQuizHud({ onStop: () => stopQuiz() });
let quizQueue = [];
let quizTargetKey = null;
let quizScore = 0;
let quizTotal = 0;

function nextQuizQuestion() {
  if (quizQueue.length === 0) {
    quizHud.setClue("🎉 You found them all! Great job!");
    speak("You found them all! Great job!");
    setTimeout(() => stopQuiz(), 4000);
    return;
  }
  quizTargetKey = quizQueue.pop();
  const clue = QUIZ_CLUES[quizTargetKey];
  quizHud.setClue(clue);
  quizHud.setScore(quizScore, quizTotal);
  speak(clue);
}

function handleQuizGuess(entry) {
  if (entryKey(entry) !== quizTargetKey) {
    quizHud.flashFeedback(false);
    speak("Not quite, try again!");
    return;
  }
  quizScore += 1;
  quizHud.flashFeedback(true);
  speak(`Yes! That's ${entry.info.name}!`);
  quizHud.setScore(quizScore, quizTotal);
  setTimeout(nextQuizQuestion, 1400);
}

function startQuiz() {
  stopAllModes();
  explorePanel.setVisible(false);
  quizActive = true;
  quizScore = 0;
  quizQueue = shuffledKeys(Object.keys(QUIZ_CLUES));
  quizTotal = quizQueue.length;
  quizHud.show();
  nextQuizQuestion();
}

function stopQuiz() {
  quizActive = false;
  quizHud.hide();
  stopSpeaking();
}

// --- Explore panel -----------------------------------------------------------
const explorePanel = buildExplorePanel({
  onSeasonPick: (key) => jumpToSeason(key),
  onToggleCompare: toggleCompare,
  onWeightSubmit: (lbs) => {
    const rows = [SUN, ...PLANETS, PLANETS.find((p) => p.key === "earth").moon]
      .map((b) => `<tr><td>${b.name}</td><td>${(lbs * b.gravity).toFixed(1)} lb</td></tr>`)
      .join("");
    explorePanel.setWeightResults(`<table>${rows}</table>`);
  },
  onAgeSubmit: (years) => {
    const earthDays = years * 365.256;
    const rows = PLANETS.map((p) => `<tr><td>${p.name}</td><td>${(earthDays / p.orbitalPeriodDays).toFixed(1)} yrs</td></tr>`).join("");
    explorePanel.setAgeResults(`<table>${rows}</table>`);
  },
  onSkyTonight: async () => {
    explorePanel.setSkyResults("Finding your location…");
    const loc = userLocation || (await getUserLocation());
    if (!loc) {
      explorePanel.setSkyResults("Turn on location access to see what's up tonight where you live!");
      return;
    }
    const result = getVisibleTonight(loc.lat, loc.lon);
    if (!result.visible.length) {
      explorePanel.setSkyResults(result.isDark ? "No bright planets above the horizon right now." : "It's still daylight — check back after sunset!");
      return;
    }
    const rows = result.visible
      .map((v) => `<tr><td>${v.name}</td><td>${v.compass}, ${Math.round(v.altitudeDeg)}° up</td></tr>`)
      .join("");
    const note = result.isDark ? "" : "<p style='opacity:.7;margin:4px 0 0'>Still daylight — these will be easier to see after sunset.</p>";
    explorePanel.setSkyResults(`<table>${rows}</table>${note}`);
  },
  onTourToggle: toggleTour,
  onSoundToggle: toggleSound,
  onReadAloudToggle: toggleReadAloud,
  onToggleNightSky: toggleNightSky,
  onQuizStart: startQuiz,
});
explorePanel.setSeasons(seasonDates);

// --- Controls panel ------------------------------------------------------
let playing = true;
let simDaysPerSecond = SPEED_PRESETS[DEFAULT_SPEED_INDEX].daysPerSecond;

const controlsUI = buildControls({
  onPlayPause: (isPlaying) => {
    playing = isPlaying;
  },
  onSpeedChange: (daysPerSecond) => {
    simDaysPerSecond = daysPerSecond;
  },
  onScaleChange: (mode) => {
    scaleMode = mode;
    if (!compareMode && !nightSkyActive) {
      updateBodySizes(handles, scaleMode);
      for (const obj of handles.planetObjects) rescaleOrbitLine(obj, scaleMode);
      fitCameraForScale(scaleMode, false);
    }
    fillAsteroidBelt(asteroidBelt, scaleMode);
    rescaleCometOrbit(comet.orbitLine, scaleMode);
  },
  onToggleLabels: (on) => {
    handles.sunLabel.element.classList.toggle("body-label--hidden", !on);
    for (const obj of handles.planetObjects) {
      obj.label.element.classList.toggle("body-label--hidden", !on);
      if (obj.moon) obj.moon.label.element.classList.toggle("body-label--hidden", !on);
    }
  },
  onToggleOrbits: (on) => {
    ordersVisible = on;
    if (!compareMode && !nightSkyActive) {
      for (const obj of handles.planetObjects) obj.orbitLine.visible = on;
      comet.orbitLine.visible = on;
    }
  },
  onToggleExplore: () => explorePanel.toggle(),
});

// --- Remote control (phone) -------------------------------------------------
const remote = connectRemote((msg) => {
  const { action, value } = msg;
  if (action === "playpause") controlsUI.triggerAction("playpause");
  else if (action === "speed") controlsUI.triggerAction("speed", value);
  else if (action === "scale") controlsUI.triggerAction("scale");
  else if (action === "labels") controlsUI.triggerAction("labels");
  else if (action === "orbits") controlsUI.triggerAction("orbits");
  else if (action === "exitFocus") exitFocus();
  else if (action === "focus") {
    const entry = keyToEntry.get(value);
    if (entry) selectEntry(entry);
  } else if (action === "compare") toggleCompare();
  else if (action === "season") jumpToSeason(value);
  else if (action === "tour") toggleTour();
  else if (action === "sound") toggleSound();
  else if (action === "readaloud") toggleReadAloud();
  else if (action === "nightsky") toggleNightSky();
  else if (action === "quiz") startQuiz();
  else if (action === "rotateH") rotateHoldDirH = value === "left" ? -1 : value === "right" ? 1 : 0;
  else if (action === "rotateV") rotateHoldDirV = value === "up" ? 1 : value === "down" ? -1 : 0;
  else if (action === "autospin") {
    autoSpin = !autoSpin;
    broadcastState();
  } else if (action === "reload") window.location.reload();
  else if (action === "requestState") broadcastState();
});

// --- Simulation clock ----------------------------------------------------
let simTime = new Date();

// One-shot, non-blocking — never gates the render loop.
if (HORIZONS_CALIBRATION.enabled) {
  calibrateAgainstHorizons({ timeoutMs: HORIZONS_CALIBRATION.timeoutMs });
}

const timer = new THREE.Timer();
timer.connect(document);
const _worldPos = new THREE.Vector3();
const _worldQuat = new THREE.Quaternion();
const _sunDirWorld = new THREE.Vector3();
const _orientQuat = new THREE.Quaternion();

/** Object-space direction to the Sun for any mesh, using its real current orientation. */
function computeSunDirLocal(mesh, target) {
  mesh.getWorldPosition(_worldPos);
  mesh.getWorldQuaternion(_worldQuat);
  _sunDirWorld.set(0, 0, 0).sub(_worldPos).normalize();
  return target.copy(_sunDirWorld).applyQuaternion(_worldQuat.invert());
}

function animate() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.25);
  const deltaDays = playing ? simDaysPerSecond * dt : 0;
  if (playing) simTime = new Date(simTime.getTime() + deltaDays * 86400000);

  const astroTime = makeTime(simTime);

  handles.sunMesh.quaternion.copy(getBodyOrientationQuaternion("Sun", astroTime, _orientQuat));
  handles.sunGroup.children.find((c) => c.isSprite)?.scale.setScalar(handles.sunGroup.userData.glowScale ?? 10);

  for (const obj of handles.planetObjects) {
    if (!compareMode) {
      const pos = getHelioPositionAU(obj.data.body, astroTime);
      const auDist = Math.hypot(pos.x, pos.y, pos.z) || 1e-6;
      const factor = scaleMode.distanceFn(auDist) / auDist;
      eclipticToScene(pos, obj.orbitPivot.position).multiplyScalar(factor);
    }

    obj.tiltGroup.quaternion.copy(getBodyOrientationQuaternion(obj.data.body, astroTime, _orientQuat));

    obj.sunDirLocal = obj.sunDirLocal || new THREE.Vector3();
    computeSunDirLocal(obj.mesh, obj.sunDirLocal);
    if (obj.earthMaterial) obj.earthMaterial.uniforms.sunDirection.value.copy(obj.sunDirLocal);

    if (obj.locationPin?.group.visible) {
      const isDay = obj.sunDirLocal.dot(obj.locationPin.bodyFixedVec) > 0;
      obj.locationPin.mesh.material.color.set(isDay ? 0xffd23f : 0x5477b0);
    }

    if (obj.moon && obj.moon.group.visible) {
      const off = getMoonOffsetAU(astroTime);
      const dir = eclipticToScene(off).normalize();
      const radius = obj.moon.group.userData.visualOrbitRadius ?? 2;
      obj.moon.group.position.copy(dir.multiplyScalar(radius));
      obj.moon.mesh.quaternion.copy(getBodyOrientationQuaternion("Moon", astroTime, _orientQuat));
      obj.moon.sunDirLocal = obj.moon.sunDirLocal || new THREE.Vector3();
      computeSunDirLocal(obj.moon.mesh, obj.moon.sunDirLocal);
      if (obj.moon.dayNightMaterial) obj.moon.dayNightMaterial.uniforms.sunDirection.value.copy(obj.moon.sunDirLocal);
    }
  }

  if (!compareMode) updateComet(comet, simTime, scaleMode);

  if (nightSkyActive) {
    const now = performance.now();
    if (now - lastNightSkyUpdate > 5000) {
      lastNightSkyUpdate = now;
      refreshNightSky();
    }
  }

  focus.update();

  if (rotateHoldDirH !== 0 || rotateHoldDirV !== 0) {
    rotateView(rotateHoldDirH * ROTATE_HOLD_SPEED * dt, rotateHoldDirV * ROTATE_HOLD_SPEED * dt);
  } else if (autoSpin) rotateView(AUTO_SPIN_SPEED * dt);

  if (activeEntry) {
    if (activeEntry.kind === "earth") {
      if (earthObj.locationPin.group.visible) {
        const pv = earthObj.locationPin.bodyFixedVec;
        const isDay = earthObj.sunDirLocal.dot(pv) > 0;
        const localTimeStr = simTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        focusOverlay.setStatus(`${isDay ? "☀️ It's daytime" : "🌙 It's nighttime"} where you are (${localTimeStr}).`);
      } else if (locationState === "pending") {
        focusOverlay.setStatus("Finding your location…");
      } else {
        focusOverlay.setStatus("Turn on location access to see day and night where you live!");
      }
      const now = performance.now();
      if (now - lastIssFetch > 15000) {
        lastIssFetch = now;
        refreshIss();
      }
      if (issInfo) {
        focusOverlay.setExtraHTML(
          `🛰️ The ISS is ${Math.round(issInfo.altitudeKm)} km up right now, circling at ${Math.round(issInfo.velocityKmh).toLocaleString()} km/h — click the little dot on the globe!`
        );
      }
    } else if (activeEntry.kind === "moon") {
      const now = performance.now();
      if (now - lastPhaseUpdate > 1000) {
        lastPhaseUpdate = now;
        const phase = getMoonPhaseInfo(simTime);
        focusOverlay.setExtraHTML(`${phase.emoji} <strong>${phase.name}</strong> — ${Math.round(phase.illumination * 100)}% lit right now`);
      }
    }
  }

  controls.update();

  if (composer) composer.render();
  else renderer.render(scene, camera);
  labelRenderer.render(scene, camera);

  requestAnimationFrame(animate);
}

// --- Resize ---------------------------------------------------------------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
});

// --- Kick off --------------------------------------------------------------
const loadingScreen = document.getElementById("loading-screen");
loadingScreen.classList.add("loading-screen--hidden");
setTimeout(() => loadingScreen.remove(), 500);

requestAnimationFrame(animate);
