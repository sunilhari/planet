# CLAUDE.md

Guidance for Claude Code sessions working in this repository.

## What this is

A live, real-time 3D solar system visualization, built to run on a projector (deployed to a Raspberry Pi kiosk) so the user can teach his 5-year-old son about planetary orbits, rotation, day/night, and scale. Kid-friendly by default ("Storybook" scale), with a "True Scale" toggle for accuracy. All positions and orientations are computed from real ephemeris data, not scripted animation.

Two companion documents describe the product and its implementation in full:

- **[TRD.md](TRD.md)** — Technical Requirements Document: every feature, who it's for, and why.
- **[DD.md](DD.md)** — Design Document: architecture, module map, key algorithms, the WebSocket remote-control protocol.

**Keep both in sync with the code.** Any change that adds/removes a feature, changes user-facing behavior, or changes the architecture (new module, new WS message, new scene-graph pattern) must be reflected in TRD.md and/or DD.md in the same piece of work — not deferred. If you're not sure whether a change is significant enough to document, err toward updating them; they're the source of truth for a future session that has no memory of this one.

## Stack

- Vite (build/dev server) + vanilla JS modules (no framework) + Three.js (r186) for the 3D scene.
- `astronomy-engine` for real heliocentric positions, axial tilt/rotation, seasons, moon phase, and alt-az sky computations.
- Express + `ws` (`server.js`) for the production/kiosk server: serves the built `dist/`, the phone remote page (`public/remote/`), and relays WebSocket messages between the display and any connected remotes.

## Commands

- `npm run dev` — Vite dev server on port 9000. **The WebSocket relay does not run under this** — the phone remote will show "connecting…" forever. Use this only for iterating on visuals/UI that don't involve the remote.
- `npm run build` — production build to `dist/`.
- `npm run serve` (alias: `node server.js`) — serves the built `dist/` + remote + WS relay on port 9000. **Use this whenever testing anything remote-control-related** (build first).

## Architecture in one paragraph

`src/main.js` orchestrates everything: it builds the scene once (`src/scene/build.js`), then on every `requestAnimationFrame` recomputes each body's position (`getHelioPositionAU`) and true orientation (`getBodyOrientationQuaternion`) from `astronomy-engine` and applies them directly — there is no keyframed animation. A `orbitPivot → tiltGroup → mesh` hierarchy separates "where" (position, updated per frame) from "which way it's facing" (orientation, updated per frame) from the mesh's own identity geometry. See DD.md for the full pattern and the ecliptic→scene coordinate mapping.

## Known gotchas (read before debugging something that "isn't working")

- **Chrome background-tab `requestAnimationFrame` throttling** breaks automated visual testing, not the app. If you drive the display tab via browser automation, click into a *different* tab (e.g. the phone remote) and the display tab goes to background — Chrome throttles or pauses its rAF loop, so screenshots taken during that window look frozen even though the code is correct. To test continuous-animation features (auto-spin, hold-rotate, the sim clock) without this false alarm, either keep the display tab focused throughout, or inject WebSocket messages directly from the display tab's own console (`new WebSocket(...)`) instead of clicking a separate remote tab. This has burned real debugging time twice in this project's history — don't repeat it.
- **`ws` forwards messages as binary Buffers by default.** `server.js`'s relay explicitly does `data.toString()` before re-sending, otherwise browsers receive a `Blob` instead of a string and `JSON.parse` on the client silently fails. If you touch the relay, keep this.
- **Vite's dev server doesn't resolve `/remote/` (trailing slash, no filename) against `public/`** — it falls back to the SPA `index.html`. `/remote/index.html` (explicit filename) works fine in dev; `server.js` (Express, production) resolves the directory index correctly either way. Not a bug, just a dev-only quirk — don't "fix" it.
- **Real textures and the ambient audio are synthesized/bundled at *build time*, not fetched at runtime** — this is why they don't violate the "works fully offline" requirement. Any new external asset should follow the same rule: ask before downloading, then bundle it under `src/assets/`, never fetch it live from the kiosk.
- Live network calls that *do* happen at runtime (JPL Horizons startup calibration, ISS position polling) are one-shot/optional and fail silently (`console.info`, never throw, never block the render loop) — the app must keep working with zero internet.

## Pi deployment

Current known target: `sunilhari@192.168.1.10` (hostname `shadow-pi`), Node 20 preinstalled. Deploy flow:

```bash
rsync -avz --exclude node_modules --exclude .git --exclude dist \
  /Users/sunilhari/Documents/code/planet/ sunilhari@192.168.1.10:~/planet/
ssh sunilhari@192.168.1.10 "cd ~/planet && npm install && npm run build && pkill -f 'node server.js'; sleep 1; nohup node server.js > /tmp/planet-server.log 2>&1 < /dev/null & disown"
```

The SSH connection to this Pi is occasionally flaky (drops mid-command, `exit 255`) — if a restart command fails, just retry the final `nohup ... &` step alone with a fresh SSH call and verify with `pgrep -af 'node server.js'` + a `curl`. There is currently no systemd service / auto-start-on-boot — the display must be manually (re)started via SSH after a reboot unless that's set up later (ask before adding one, since it's a persistent system change).

## Style notes specific to this project

- No comments explaining *what* code does — only *why*, and only when non-obvious (e.g. the binary-vs-text WS gotcha above, the reflection-vs-rotation coordinate mapping in `orientation.js`).
- New Explore-panel features should follow the existing `stopAllModes()` mutual-exclusion pattern (see DD.md) rather than hand-rolling their own state juggling.
- Any new remote-controllable toggle (sound/read-aloud/auto-spin style) must broadcast its state back to the remote via `broadcastState()` in `main.js` — the remote is not the source of truth, the display is (see DD.md's WebSocket protocol section for why).
