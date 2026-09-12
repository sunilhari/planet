# Technical Requirements Document

**Project:** Live 3D Solar System (projector/kiosk)
**Audience:** A 5-year-old, guided by a parent holding a phone remote, on a projected display.
**Keep in sync:** update this file whenever a feature is added, removed, or its behavior changes materially. See [CLAUDE.md](CLAUDE.md).

## 1. Purpose

Give a young child an intuitive, visually real feel for how the solar system actually works — orbits, rotation, axial tilt, day/night, relative sizes and distances — using genuine astronomical data rather than a scripted cartoon, while staying simple enough for a 5-year-old to drive (or watch a parent drive) via a phone.

## 2. Core visualization requirements

| # | Requirement |
|---|---|
| 2.1 | Render the Sun, all 8 planets, and Earth's Moon in a live 3D scene. |
| 2.2 | Every body's position is computed from real ephemeris (`astronomy-engine`), not keyframed — the scene reflects the actual current date/time (or a simulated time, once fast-forwarded). |
| 2.3 | Every body's rotation (axial tilt + current spin phase) is computed from real astronomical data — Earth's tilt, Uranus's sideways spin, Venus's retrograde/slow rotation, etc. are all physically accurate, not approximated. |
| 2.4 | Every body renders with real public-domain (Solar System Scope / NASA-USGS-style) surface imagery, bundled at build time: Sun, Mercury, Venus, Earth (day + night + clouds, separately), Moon (day, with a derived darkened night texture), Mars, Jupiter, Saturn (+ real ring texture), Uranus, Neptune. |
| 2.5 | Earth renders with a real-time day/night terminator (custom shader, sun-direction-driven) plus a separate translucent moving cloud layer. |
| 2.6 | Saturn's rings use a real ring texture; Uranus/Neptune rings are procedural (no equivalent public-domain texture used). |
| 2.7 | Two selectable scale modes: **Storybook** (compressed distances, exaggerated sizes so small/distant bodies stay visible and clickable — the default) and **True Scale** (physically proportional; intentionally makes most planets nearly invisible dots, which is itself the lesson). |
| 2.8 | Simulation speed is adjustable across 6 presets from real-time to 1 month/second, plus play/pause. |
| 2.9 | Orbit paths and body labels are independently toggleable. |
| 2.10 | Performance auto-tiers down (fewer sphere segments, no bloom/shadows, smaller starfield/asteroid belt, capped pixel ratio) when running on a Raspberry Pi or a small screen, auto-detected via user-agent/screen size, or forced via `?quality=trim`/`?quality=full`. |

## 3. Focus ("full-screen") view

| # | Requirement |
|---|---|
| 3.1 | Clicking any body (Sun, planet, or Moon) tweens the camera into a close, isolated, cinematic view of just that body. |
| 3.2 | While focused, every *other* planet, its orbit line, the asteroid belt, and the comet are hidden — the focused body must never be visually crowded or overlapped by another body that happens to lie along the current camera direction (this was a real regression once rotate was added; see DD.md §6). Earth's Moon stays visible when Earth itself is focused (and vice versa). |
| 3.3 | The on-screen control dock and Explore panel auto-hide while focused, so the view reads as genuinely full-screen. |
| 3.4 | The focus camera continues following the body's real orbital motion while focused (it doesn't freeze in space). |
| 3.5 | A info card shows the body's name, average temperature (°C/°F), and a kid-friendly fun fact; the fact is read aloud via TTS if Read Aloud is on. |
| 3.6 | Exiting focus (Back button, Escape key, clicking empty space, or the remote) tweens back to the previously saved wide view and restores everything hidden by 3.2/3.3. |
| 3.7 | The user can manually rotate the focused (or wide) view — horizontally and vertically — via the phone remote's hold-to-rotate buttons, or start a hands-free continuous auto-spin toggle. Vertical rotation is clamped so the view can never flip over a pole. |

## 4. Earth-specific features

| # | Requirement |
|---|---|
| 4.1 | With the user's location permission, show a "you are here" pin on Earth, lit/dark depending on real local day/night. |
| 4.2 | Show local day/night status and local time text while Earth is focused. |
| 4.3 | Live ISS position tracker: a marker on the Earth mesh at the ISS's real current lat/lon (public API, refreshed periodically, graceful silent fallback if unreachable — never blocks rendering). |
| 4.4 | Historic landing site markers: Apollo missions (on the Moon) and Mars rover/lander sites (on Mars), each showing a fun fact on click/tap. |

## 5. Educational / Explore panel features

All of the following are reachable from the on-screen "Explore" panel and, where noted, from the phone remote:

| # | Feature | Remote-controllable? |
|---|---|---|
| 5.1 | **Seasons** — jump simulated time to the equinoxes/solstices, with an explanation that Earth's tilt (not distance) causes seasons. | Yes |
| 5.2 | **Compare Sizes** — lines up all 8 planets at true relative size, Sun hidden but its light kept active so every body still renders correctly lit. | Yes |
| 5.3 | **My Weight on Other Planets** — numeric input → table of weight scaled by each body's surface gravity. | No (on-screen input only) |
| 5.4 | **My Age on Other Planets** — numeric input → table of "age" in each planet's orbital years. | No (on-screen input only) |
| 5.5 | **Sky Tonight** — using the user's location, lists which planets are above the horizon right now and roughly where. | No (on-screen input only) |
| 5.6 | **Night Sky** — replaces the scene with a real star dome + constellation lines computed for the user's real lat/lon and current time. | Yes |
| 5.7 | **Quiz** — "find the planet" guessing game with kid-friendly clues; tapping the correct body (on-screen *or* via the remote's planet grid, which answers instead of focusing while a quiz is active) scores a point. | Yes (planet grid doubles as the answer input) |
| 5.8 | **Guided Tour** — auto-cycles the focus view through Sun → every planet → Moon on a timer. | Yes |
| 5.9 | **Read Facts Aloud** — text-to-speech toggle for focus-view facts and quiz clues. State is synced live to the remote. | Yes |
| 5.10 | **Sound** — immersive procedural ambient space audio toggle (see §7). State is synced live to the remote. | Yes |
| 5.11 | **Moon phase** — while the Moon is focused, shows the real current phase name/emoji and % illumination. | N/A (automatic) |

Removed (deliberately, per explicit request): Gravity Machine (Newton's-cannonball physics demo), Road Trip (drive-time calculator), Eclipses, Meteor Shower calendar.

## 6. Audio

| # | Requirement |
|---|---|
| 6.1 | Immersive procedural "deep space" ambience — sub-bass drone chord, filtered brown-noise "cosmic wind" bed, sparse high shimmer tones through a cheap feedback-delay reverb — entirely synthesized via the Web Audio API (no audio files), so the kiosk stays fully offline. |
| 6.2 | Ambience auto-starts on the very first tap/click anywhere on the display (browsers require a user gesture before audio can play), without requiring the user to open the Explore panel first. Still toggleable off/on afterward. |
| 6.3 | A short filtered "whoosh" sound effect plays on entering/exiting focus view (gated by the same Sound toggle). |

## 7. Phone remote control

A same-network web page (`/remote`) intended for the parent to drive the display without needing to be at the screen (e.g. once the display is fullscreen on a projector and no longer touchable).

| # | Requirement |
|---|---|
| 7.1 | Playback: play/pause, speed slider, storybook/true scale toggle. |
| 7.2 | View: labels toggle, orbits toggle, exit-focus. |
| 7.3 | Focus on any planet/Moon/Sun via a button grid; during an active quiz, the same buttons answer the quiz instead. |
| 7.4 | Rotate the current view: hold-to-rotate left/right (azimuth) and up/down (tilt), plus a hands-free auto-spin toggle. |
| 7.5 | Explore actions: compare sizes, seasons (4 buttons), night sky, quiz start, tour, sound toggle, read-aloud toggle — the last two rendered with a live On/Off indicator reflecting the *display's* actual current state, not an optimistic local guess (state can change on the display's own — e.g. first-gesture sound autostart, or focus-exit resetting auto-spin — so the remote must sync from the display, not assume). |
| 7.6 | **Reload Display** — a recovery action for when the display's rendering appears frozen/broken; reloads the display's page remotely. No confirmation dialog (low-risk, instantly recoverable). |
| 7.7 | The remote requests the display's current toggle state on every (re)connect, so opening the remote mid-session (or after a Wi-Fi drop) shows correct state immediately rather than stale defaults. |

## 8. Deployment / operational requirements

| # | Requirement |
|---|---|
| 8.1 | Must run fully offline once loaded — no required runtime network access. All textures and audio are bundled at build time. |
| 8.2 | Deployable to a Raspberry Pi as a kiosk display: a single Node process (`server.js`) serves the built app, the phone remote, and relays WebSocket messages between them, all on the local network (no internet, no accounts). |
| 8.3 | Auto-detected performance tiering keeps the Pi build smooth (see §2.10). |
| 8.4 | Port 9000 for both the dev server and the production server. |

## 9. Non-goals / explicitly removed

- No accounts, no cloud sync, no telemetry.
- No destructive or unsafe interactions (this is a child-facing kiosk).
- Gravity Machine, Road Trip calculator, Eclipses, Meteor Shower calendar — removed per explicit request; do not re-add without being asked.
