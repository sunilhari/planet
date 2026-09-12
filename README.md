# 🪐 Solar System Projector

A live, real-time 3D solar system, built to run on a projector so a curious kid can watch the planets actually orbit and spin — using real ephemeris data, not a scripted animation. Includes a phone remote so you can drive the show without touching the screen.

## Features

- **Real astronomy**: every planet's position and rotation (including real axial tilt — Uranus really does spin on its side) comes from [`astronomy-engine`](https://github.com/cosinekitty/astronomy), computed live, not keyframed.
- **Real imagery**: every body — Sun, planets, rings, Moon — renders with real public-domain surface textures, including a live day/night terminator and moving clouds on Earth.
- **Two scales**: kid-friendly "Storybook" scale (default) or physically accurate "True Scale" — flip between them to see just how empty space really is.
- **Click any planet** for a full-screen close-up with a fun fact, read aloud if you like.
- **A whole Explore panel**: seasons, a size comparison line-up, weight/age-on-other-planets calculators, tonight's real sky from your location, a real constellation view, a "find the planet" quiz, a guided tour, and an immersive ambient space soundscape.
- **Live extras**: a "you are here" pin and real day/night on Earth, a live ISS tracker, and historic Apollo/Mars-rover landing site markers.
- **Phone remote** (`/remote`): play/pause, speed, scale, focus on any body, rotate/auto-spin the view, answer quiz questions, and a one-tap display reload — all from your phone, no app required.
- Runs **fully offline** once loaded, and auto-tunes its quality for a Raspberry Pi.

See [TRD.md](TRD.md) for the full feature list and [DD.md](DD.md) for how it's built.

## Running it locally

```bash
npm install
npm run dev       # http://localhost:9000 — visuals/UI only, no remote-control relay
```

To test the phone remote too, build and run the real server instead (Vite's dev server doesn't run the WebSocket relay):

```bash
npm run build
npm run serve      # http://localhost:9000, plus http://localhost:9000/remote
```

## Deploying to a Raspberry Pi (or any kiosk box on your network)

```bash
rsync -avz --exclude node_modules --exclude .git --exclude dist \
  ./ user@your-pi:~/planet/
ssh user@your-pi "cd ~/planet && npm install && npm run build && node server.js"
```

Then open `http://<pi-ip>:9000` fullscreen on the projector, and `http://<pi-ip>:9000/remote` on your phone (same Wi-Fi).

## Project docs

- [TRD.md](TRD.md) — full requirements: what the app does and why.
- [DD.md](DD.md) — architecture, the scene-graph and orientation math, the WebSocket remote-control protocol.
- [CLAUDE.md](CLAUDE.md) — notes for AI coding agents working in this repo (gotchas, conventions, deploy workflow).
