// Live ISS position — unlike planets/comets, a satellite's orbit decays and
// shifts constantly, so there's no offline-computable ephemeris for it. We
// ask a public API for its current lat/lon/altitude/speed when online, and
// simply don't show the marker when we can't reach it (no fake position).
const API_URL = "https://api.wheretheiss.at/v1/satellites/25544";

export async function fetchISSPosition() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`ISS API HTTP ${res.status}`);
    const data = await res.json();
    return {
      lat: data.latitude,
      lon: data.longitude,
      altitudeKm: data.altitude,
      velocityKmh: data.velocity,
    };
  } catch (err) {
    console.info("[iss] live position unavailable (offline or blocked):", err.message);
    return null;
  }
}
