// Quality tier controls how expensive the scene is to render.
// "full"  -> desktop/laptop: bloom, shadows, dense starfield, asteroid belt
// "trim"  -> Raspberry Pi: no post-processing, lighter geometry, fewer particles
// Force a tier with ?quality=trim in the URL; otherwise it's auto-detected.
function detectQuality() {
  const params = new URLSearchParams(location.search);
  const forced = params.get("quality");
  if (forced === "trim" || forced === "full") return forced;

  const ua = navigator.userAgent;
  const isArmLinux = /Linux (armv7l|aarch64)/i.test(ua) || /Raspberry/i.test(ua);
  const isSmallScreen = window.screen.width * window.screen.height <= 1280 * 800;
  return isArmLinux || isSmallScreen ? "trim" : "full";
}

export const QUALITY = detectQuality();

export const TIER = {
  full: {
    bloom: true,
    shadows: true,
    sphereSegments: 64,
    starCount: 6000,
    asteroidCount: 1200,
    ringSegments: 128,
    pixelRatioCap: 2,
  },
  trim: {
    bloom: false,
    shadows: false,
    sphereSegments: 20,
    starCount: 1200,
    asteroidCount: 250,
    ringSegments: 48,
    pixelRatioCap: 1,
  },
}[QUALITY];

// Scene scale: how many scene-units per AU / per Earth-radius, for each mode.
export const SCALE_MODES = {
  storybook: {
    label: "Storybook",
    // Distance compressed with sqrt so outer planets still fit on screen.
    distanceFn: (au) => 6 + Math.sqrt(au) * 9,
    // Size exaggerated with a mild log curve so Mercury isn't a speck
    // and Jupiter doesn't swallow the screen.
    radiusFn: (earthRadii) => 0.55 + Math.log2(1 + earthRadii) * 0.6,
    sunRadius: 3.2,
    showTrueScaleHint: true,
  },
  true: {
    label: "True Scale",
    // 1 AU = 40 scene units puts Neptune ~1200 units out.
    distanceFn: (au) => au * 40,
    // Earth radius = 0.11 scene units keeps relative sizes honest;
    // planets will look like near-invisible dots next to the distances above.
    // That contrast *is* the point of this mode.
    radiusFn: (earthRadii) => earthRadii * 0.11,
    sunRadius: 12, // real ratio would be ~109 Earth radii; capped for renderability
    showTrueScaleHint: false,
  },
};

export const DEFAULT_SCALE_MODE = "storybook";

// Simulation speed presets, in Earth-days advanced per real second.
export const SPEED_PRESETS = [
  { label: "Real-time", daysPerSecond: 1 / 86400 },
  { label: "1 min/sec", daysPerSecond: 1 / 1440 },
  { label: "1 hour/sec", daysPerSecond: 1 / 24 },
  { label: "1 day/sec", daysPerSecond: 1 },
  { label: "1 week/sec", daysPerSecond: 7 },
  { label: "1 month/sec", daysPerSecond: 30 },
];

export const DEFAULT_SPEED_INDEX = 3; // "1 day/sec" — orbits crawl, spins are obvious

// Optional one-shot calibration against JPL Horizons at startup.
// Never called per-frame; purely a "is our local math right?" cross-check,
// and the app works fully offline if this fails or is disabled.
export const HORIZONS_CALIBRATION = {
  enabled: true,
  timeoutMs: 4000,
};
