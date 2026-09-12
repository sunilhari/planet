# Design Document

**Project:** Live 3D Solar System (projector/kiosk)
**Keep in sync:** update this file whenever architecture, module boundaries, or the WebSocket protocol change. See [CLAUDE.md](CLAUDE.md). For *what* the product does, see [TRD.md](TRD.md).

## 1. High-level architecture

```
┌─────────────────────────┐        WebSocket (JSON text frames)      ┌──────────────────────────┐
│  Display (kiosk browser) │◄─────────────────────────────────────►│  server.js (Express + ws) │
│  src/main.js orchestrates│        relays every message to          │  serves dist/ + /remote   │
│  Three.js scene + UI     │        "all other clients"               │  no message-type logic    │
└─────────────────────────┘                                          └──────────────────────────┘
                                                                                    ▲
                                                                                    │ same relay
                                                                                    ▼
                                                                    ┌──────────────────────────┐
                                                                    │ Phone remote (browser)    │
                                                                    │ public/remote/index.html  │
                                                                    │ plain DOM + vanilla JS     │
                                                                    └──────────────────────────┘
```

`server.js` is a dumb relay — it has no knowledge of message shape, it just re-broadcasts any text frame to every other connected client. All protocol semantics live in `src/remoteClient.js` (display side) and `public/remote/index.html` (remote side). This means the display and any number of remotes are peers on the same channel; today only the display *acts on* `action` messages and only the remote *acts on* `type: "state"` messages, but nothing at the transport layer enforces that.

## 2. Module map

```
src/
  main.js              orchestration: scene setup, click/remote handling, the animate() loop
  config.js            QUALITY/TIER (performance), SCALE_MODES, SPEED_PRESETS, Horizons calibration flag
  astro.js             astronomy-engine wrappers: getHelioPositionAU, getMoonOffsetAU, makeTime, Horizons calibration
  orientation.js       real axial-tilt + spin quaternion (getBodyOrientationQuaternion), lat/lon -> body-fixed vector
  coords.js            eclipticToScene() — the one proper-rotation position mapping used everywhere
  data/
    bodies.js          static physical constants (radius, orbital period, texture key, rings, fun facts) — NOT positions
    landmarks.js        Apollo + Mars rover site lat/lon + facts
  scene/
    build.js           builds the whole THREE scene graph once; orbitPivot/tiltGroup/mesh pattern (see §3)
    earthMaterial.js    custom day/night ShaderMaterial, reused for Earth and the Moon
    starfield.js, asteroidBelt.js, nightSkyScene.js, landmarks.js   supporting scene pieces
  textures.js          real-texture loader helpers (loadPlanetTexture/loadRingTexture/loadMoonDayNightTextures) + a couple of procedural fallbacks (glow, Uranus/Neptune rings)
  assets/textures/     the actual bundled JPG/PNG files + index.js manifest (Vite asset imports -> hashed URLs)
  focus.js             createFocusController — tween camera into/out of a body, follow it while focused
  audio.js             procedural ambient space audio (Web Audio API), + the focus-transition whoosh
  speech.js            TTS wrapper (Web Speech API) + Read Aloud toggle state
  tour.js              guided-tour step sequencer
  quiz.js              quiz clue data + shuffle helper
  comet.js             Halley's-comet-style demo orbit
  seasons.js, moonPhase.js, scaleCompare.js, whatsUpTonight.js, geo.js, iss.js   small focused calculators/fetchers
  nightSky.js          star catalog + constellation lines + alt-az math for Night Sky mode
  remoteClient.js      WebSocket client for the display; connect + send()
  ui/controls.js       all plain-DOM UI panels (control dock, focus overlay, Explore panel, quiz HUD, toast)
  style.css
public/remote/index.html   the phone remote — a single self-contained HTML file, own inline CSS/JS
server.js              Express static server + ws relay (production/kiosk only)
```

## 3. Scene graph pattern

Every planet is built as:

```
orbitPivot (Group)          <- position set every frame from ephemeris (getHelioPositionAU -> eclipticToScene)
  └─ tiltGroup (Group)       <- quaternion set every frame from real orientation (getBodyOrientationQuaternion)
       └─ mesh (Mesh)        <- identity local transform; geometry/material only
       └─ ringMesh?          <- child of tiltGroup, not mesh, so rings don't inherit any mesh-local scale quirks
  └─ moonGroup?               <- separate child of orbitPivot, own per-frame position (getMoonOffsetAU) + own tiltGroup-equivalent
  └─ label (CSS2DObject)
```

Rationale: separating "where" (orbitPivot) from "which way it's facing" (tiltGroup) from "the geometry itself" (mesh) means the per-frame update loop never has to compose position and orientation into one matrix by hand — each Object3D owns exactly one concern. `orbitLine` (the visible orbit path) is a *sibling* of orbitPivot added directly to the scene root, not a child — remember this when toggling visibility (see §6, the Compare Sizes bug).

The Sun is simpler (no orbit): `sunGroup` directly holds the mesh, a corona sprite, a label, and the scene's one real light source (`THREE.PointLight`, `distance=0, decay=0` — i.e. no falloff, so it illuminates bodies at any distance equally, important for Compare Sizes where planets are laid out far from the origin).

## 4. Orientation math

`orientation.js` composes, per body per frame:

1. **Body-fixed → EQJ**: from `astronomy-engine`'s `RotationAxis` (RA, Dec, spin `W`), build `Rz(ra0+90°) · Rx(90°-dec0) · Rz(W)` — the standard IAU rotation-axis formula.
2. **EQJ → ecliptic**: `astronomy-engine`'s `Rotation_EQJ_ECL()` matrix, converted to a quaternion.
3. **Ecliptic → scene space**: a fixed proper rotation (see `coords.js`), *not* a mirror. This matters: the position mapping `(x, y, z) -> (x, z, -y)` is a genuine rotation (determinant +1); an earlier, since-fixed version used `(x, z, y)`, which is a reflection (determinant -1) and silently flips handedness, making axial tilt/rotation direction subtly wrong. If you ever touch `eclipticToScene`, verify the mapping is still a proper rotation before shipping it.

## 5. Day/night shader (`scene/earthMaterial.js`)

Custom `ShaderMaterial`, not `MeshStandardMaterial` — it does not participate in scene lighting at all. It takes `dayTexture`, `nightTexture`, and a per-frame `sunDirection` uniform in **object space** (computed via `computeSunDirLocal()` in `main.js`, which transforms the world-space sun direction into the mesh's local frame using its current world quaternion). Object-space normal · sunDirection, smoothstep-blended across the terminator, with the night texture boosted ×1.6 so city lights read clearly. Reused verbatim for the Moon (with a synthesized night texture — the real day photo drawn to a canvas with a dark overlay, since there's no real "Moon night" photo).

Because this material ignores scene lighting, hiding the Sun's `PointLight` has *no effect* on Earth or the Moon — only on the `MeshStandardMaterial` bodies (every other planet). This asymmetry caused a real bug (§6).

## 6. Known bug pattern: don't hide the light with the Sun

Every non-Earth planet uses `MeshStandardMaterial`, which requires a real light source. The scene has exactly one (`sunLight`, a child of `sunGroup`). Any feature that hides "the Sun" for visual reasons (Compare Sizes originally did `sunGroup.visible = false`) **must hide only the Sun's mesh/glow/label**, never the whole group — otherwise every standard-material planet goes black. The fix pattern (see `setSunBodyVisible()` / `setOtherBodiesVisible()` in `main.js`) is: toggle visibility on the specific visual children, keep the group (and its light) alive. Apply this same care to any future "hide the sun for effect" feature.

## 7. Mode/state management in `main.js`

- **Mutual-exclusion "takeover modes"**: `compareMode`, `nightSkyActive`, `quizActive`, `tour.isRunning`, and focus (`focus.isActive`) are meant to be exclusive. `stopAllModes()` tears down whichever is active before any new mode starts, so each `enterX()` function doesn't need to know about every other mode.
- **Focus isolation**: `enterFocus()` additionally calls `setOtherBodiesVisible(false, exceptKey)` (skips the focused planet, and Earth when the Moon is focused) so the close-up view can never be visually crowded by another body's real position — this was added after rotate/auto-spin made it possible to swing the camera toward wherever another planet actually is. `exitFocus()` restores it, but skips doing so if compare/night-sky mode is (about to be) active, since those modes manage the same visibility flags themselves.
- **Manual rotate** (`rotateView(deltaAzimuth, deltaPolar)`): reads the camera's current offset from `controls.target` as a `THREE.Spherical`, adjusts `theta`/`phi`, writes the camera position back. This works in *both* the wide view and focus view because `OrbitControls.update()` re-derives its internal spherical state from the camera's actual position at the top of every call (confirmed against the installed `OrbitControls.js` source) rather than maintaining independent persistent state — so a direct position mutation before `controls.update()` is picked up correctly, no special-casing needed. `phi` is clamped to `[MIN_POLAR, π - MIN_POLAR]` so the view can never flip over a pole. Driven by two hold-direction variables (`rotateHoldDirH`, `rotateHoldDirV`, each -1/0/1) plus an independent `autoSpin` boolean (horizontal-only), both settable only via remote messages.

## 8. Real-texture pipeline

`src/assets/textures/*.{jpg,png}` are real Solar System Scope (CC BY 4.0) images, downloaded once and committed as build-time assets (not runtime fetches — this is why bundling them doesn't violate the offline requirement). `assets/textures/index.js` imports each one so Vite gives back a hashed URL string; `scene/build.js` loads them via `THREE.TextureLoader` (`loadPlanetTexture`), which returns a texture object synchronously and mutates it in place once the image decodes — the standard Three.js async-texture pattern, no special handling needed except for the Moon, which needs pixel access to synthesize its night texture from the day photo (`loadMoonDayNightTextures`, callback-based, backed by a 1×1 black `DataTexture` placeholder until ready).

## 9. Ambient audio design (`audio.js`)

All Web Audio API, no files:

- **Cosmic wind**: ~4s of brown noise (leaky-integrated white noise) in a looping `AudioBufferSourceNode`, lowpass-filtered with a slow LFO on cutoff frequency for a "breathing" quality.
- **Sub-bass drone**: 3 sine oscillators (D1/A1/D2) each with an independent slow tremolo LFO on gain.
- **Soft pad**: 2 detuned triangle oscillators, heavily lowpassed, very quiet — harmonic warmth only.
- **Shimmer**: randomly-timed (every 3–9s) short sine "bell" tones from a high pentatonic-ish set, randomly panned, sent through a cheap 2-tap feedback-delay "reverb" (no convolver/impulse-response file).
- Master gain ramps in over 3s on enable, ramps out over 0.6s on disable (avoids clicks).
- **Autostart**: a `{ once: true }` `pointerdown` listener on `window` calls `setSoundEnabled(true)` on the very first tap anywhere, satisfying the browser's user-gesture requirement for audio while making the ambience feel default-on. Still fully toggleable afterward via the Explore panel or remote.

## 10. WebSocket protocol

Plain JSON text frames, always `{ action, value? }` (remote → display) or `{ type: "state", ... }` (display → remote). `server.js` relays verbatim to every other connected client — no filtering by type.

**Remote → display (`action`):**

| action | value | effect |
|---|---|---|
| `playpause` | — | toggles play/pause |
| `speed` | 0–5 | sets speed preset index |
| `scale` | — | toggles storybook/true scale |
| `labels` / `orbits` | — | toggles that overlay |
| `exitFocus` | — | exits focus view |
| `focus` | planet key (lowercase) | focuses that body, **or** answers the active quiz if one is running (`selectEntry()` — shared with the on-screen click handler) |
| `compare` | — | toggles Compare Sizes mode |
| `season` | `mar`/`jun`/`sep`/`dec` | jumps sim time to that equinox/solstice |
| `tour` | — | toggles the guided tour |
| `sound` / `readaloud` | — | toggles that feature; triggers a `state` broadcast |
| `nightsky` | — | toggles Night Sky mode |
| `quiz` | — | starts the quiz |
| `rotateH` | `left`/`right`/`stop` | sets horizontal hold-rotate direction |
| `rotateV` | `up`/`down`/`stop` | sets vertical hold-rotate direction |
| `autospin` | — | toggles hands-free auto-spin; triggers a `state` broadcast |
| `reload` | — | `window.location.reload()` on the display |
| `requestState` | — | display responds with a `state` broadcast (sent by the remote on every WS connect/reconnect) |

**Display → remote (`type: "state"`):** `{ type: "state", sound: bool, readAloud: bool, autoSpin: bool }`. Sent whenever any of these three change *for any reason* — including ones the remote didn't cause (first-gesture sound autostart, `exitFocus()` resetting auto-spin) — because the remote treats the display as the sole source of truth and never optimistically guesses its own button state.

## 11. Why the remote is a separate static HTML file, not a build target

`public/remote/index.html` is hand-written vanilla JS/CSS, served as a static file (via Vite's `public/` passthrough in dev, via `express.static` in production) rather than a second Vite entry point. It's small enough that this is simpler than wiring up a multi-page build, and it deliberately shares no code with `main.js` (the two sides only agree on the wire protocol in §10) — if the remote ever needs real UI complexity, revisit this.

## 12. Deployment topology

Single Node process (`server.js`) on the Pi, port 9000, serving three things from one Express app: the built SPA (`dist/`), the remote (`public/remote/`), and the WS relay — all on the local network only, no internet dependency at runtime. See CLAUDE.md for the current deploy command and the SSH-flakiness workaround.
