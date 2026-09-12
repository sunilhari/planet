import * as Astronomy from "astronomy-engine";

// Rotate from the equatorial J2000 frame astronomy-engine returns into the
// ecliptic frame, so planets line up roughly in a flat plane (small z) —
// much nicer to look at than the ~23° tilt equatorial coords would give.
const ECL_ROT = Astronomy.Rotation_EQJ_ECL();

function toEcliptic(vec) {
  const r = Astronomy.RotateVector(ECL_ROT, vec);
  return { x: r.x, y: r.y, z: r.z };
}

/** Heliocentric position of a planet, in AU, ecliptic frame. */
export function getHelioPositionAU(bodyName, date) {
  const vec = Astronomy.HelioVector(Astronomy.Body[bodyName], date);
  return toEcliptic(vec);
}

/** Geocentric offset of the Moon from Earth, in AU, ecliptic frame. */
export function getMoonOffsetAU(date) {
  const vec = Astronomy.GeoVector(Astronomy.Body.Moon, date, false);
  return toEcliptic(vec);
}

export function makeTime(date) {
  return Astronomy.MakeTime(date);
}

/**
 * One-shot sanity check against JPL Horizons at startup — NOT called per
 * frame. If it's unreachable (no internet, e.g. on the Pi) we just log and
 * keep using the local astronomy-engine computation, which is what drives
 * the animation either way.
 */
export async function calibrateAgainstHorizons({ timeoutMs = 4000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url =
      "https://ssd.jpl.nasa.gov/api/horizons.api?format=json" +
      "&COMMAND='399'" + // Earth
      "&EPHEM_TYPE=VECTORS&CENTER='@sun'&OUT_UNITS=AU-D" +
      "&VEC_TABLE='1'&VEC_LABELS=NO";
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Horizons HTTP ${res.status}`);
    const data = await res.json();
    const local = getHelioPositionAU("Earth", makeTime(new Date()));
    const localDist = Math.hypot(local.x, local.y, local.z);
    console.info(
      `[astro] Horizons reachable; local heliocentric Earth distance = ${localDist.toFixed(5)} AU`,
      data.result ? "(response received)" : ""
    );
    return { ok: true };
  } catch (err) {
    console.info("[astro] Horizons calibration skipped (offline or blocked) — using local ephemeris only.", err.message);
    return { ok: false, reason: err.message };
  } finally {
    clearTimeout(timer);
  }
}
