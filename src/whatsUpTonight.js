import * as Astronomy from "astronomy-engine";

const VISIBLE_BODIES = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function azimuthToCompass(azimuthDeg) {
  return COMPASS[Math.round(azimuthDeg / 45) % 8];
}

/** Which planets are currently above the horizon (and whether it's dark enough to see them) at a real lat/lon. */
export function getVisibleTonight(lat, lon, date = new Date()) {
  const observer = new Astronomy.Observer(lat, lon, 0);
  const time = Astronomy.MakeTime(date);

  const sunEqu = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
  const sunHor = Astronomy.Horizon(time, observer, sunEqu.ra, sunEqu.dec, "normal");
  const isDark = sunHor.altitude < -6;

  const visible = [];
  for (const name of VISIBLE_BODIES) {
    const equ = Astronomy.Equator(Astronomy.Body[name], time, observer, true, true);
    const hor = Astronomy.Horizon(time, observer, equ.ra, equ.dec, "normal");
    if (hor.altitude > 5) {
      visible.push({ name, altitudeDeg: hor.altitude, compass: azimuthToCompass(hor.azimuth) });
    }
  }
  visible.sort((a, b) => b.altitudeDeg - a.altitudeDeg);

  return { isDark, sunAltitudeDeg: sunHor.altitude, visible };
}
