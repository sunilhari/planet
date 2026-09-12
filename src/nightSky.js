import * as Astronomy from "astronomy-engine";

// Real J2000 positions for ~40 of the brightest, most recognizable stars
// across 10 well-known constellations. Approximate to the arcminute — fine
// for "that group of dots makes a shape," not for precision astrometry.
export const STARS = [
  // Ursa Major (Big Dipper)
  { name: "Dubhe", con: "Ursa Major", ra: 11.062, dec: 61.75, mag: 1.8 },
  { name: "Merak", con: "Ursa Major", ra: 11.031, dec: 56.38, mag: 2.4 },
  { name: "Phecda", con: "Ursa Major", ra: 11.897, dec: 53.69, mag: 2.4 },
  { name: "Megrez", con: "Ursa Major", ra: 12.257, dec: 57.03, mag: 3.3 },
  { name: "Alioth", con: "Ursa Major", ra: 12.9, dec: 55.96, mag: 1.8 },
  { name: "Mizar", con: "Ursa Major", ra: 13.398, dec: 54.93, mag: 2.2 },
  { name: "Alkaid", con: "Ursa Major", ra: 13.792, dec: 49.31, mag: 1.9 },
  // Ursa Minor
  { name: "Polaris", con: "Ursa Minor", ra: 2.53, dec: 89.26, mag: 2.0 },
  { name: "Kochab", con: "Ursa Minor", ra: 14.845, dec: 74.16, mag: 2.1 },
  { name: "Pherkad", con: "Ursa Minor", ra: 15.345, dec: 71.83, mag: 3.0 },
  // Orion
  { name: "Betelgeuse", con: "Orion", ra: 5.919, dec: 7.41, mag: 0.5 },
  { name: "Bellatrix", con: "Orion", ra: 5.418, dec: 6.35, mag: 1.6 },
  { name: "Mintaka", con: "Orion", ra: 5.533, dec: -0.3, mag: 2.2 },
  { name: "Alnilam", con: "Orion", ra: 5.604, dec: -1.2, mag: 1.7 },
  { name: "Alnitak", con: "Orion", ra: 5.679, dec: -1.94, mag: 1.8 },
  { name: "Saiph", con: "Orion", ra: 5.796, dec: -9.67, mag: 2.1 },
  { name: "Rigel", con: "Orion", ra: 5.242, dec: -8.2, mag: 0.1 },
  // Cassiopeia
  { name: "Schedar", con: "Cassiopeia", ra: 0.675, dec: 56.54, mag: 2.2 },
  { name: "Caph", con: "Cassiopeia", ra: 0.153, dec: 59.15, mag: 2.3 },
  { name: "Tsih", con: "Cassiopeia", ra: 0.945, dec: 60.72, mag: 2.5 },
  { name: "Ruchbah", con: "Cassiopeia", ra: 1.43, dec: 60.24, mag: 2.7 },
  { name: "Segin", con: "Cassiopeia", ra: 1.906, dec: 63.67, mag: 3.4 },
  // Leo
  { name: "Regulus", con: "Leo", ra: 10.139, dec: 11.97, mag: 1.4 },
  { name: "Algieba", con: "Leo", ra: 10.333, dec: 19.84, mag: 2.0 },
  { name: "Zosma", con: "Leo", ra: 11.235, dec: 20.52, mag: 2.6 },
  { name: "Denebola", con: "Leo", ra: 11.818, dec: 14.57, mag: 2.1 },
  // Cygnus (Northern Cross)
  { name: "Deneb", con: "Cygnus", ra: 20.69, dec: 45.28, mag: 1.3 },
  { name: "Sadr", con: "Cygnus", ra: 20.37, dec: 40.26, mag: 2.2 },
  { name: "Gienah", con: "Cygnus", ra: 20.77, dec: 33.97, mag: 2.5 },
  { name: "Fawaris", con: "Cygnus", ra: 19.75, dec: 45.13, mag: 2.9 },
  { name: "Albireo", con: "Cygnus", ra: 19.512, dec: 27.96, mag: 3.1 },
  // Scorpius
  { name: "Antares", con: "Scorpius", ra: 16.49, dec: -26.43, mag: 1.0 },
  { name: "Dschubba", con: "Scorpius", ra: 16.005, dec: -22.62, mag: 2.3 },
  { name: "Graffias", con: "Scorpius", ra: 16.09, dec: -19.81, mag: 2.6 },
  { name: "Shaula", con: "Scorpius", ra: 17.56, dec: -37.1, mag: 1.6 },
  { name: "Sargas", con: "Scorpius", ra: 17.622, dec: -43.0, mag: 1.9 },
  // Gemini
  { name: "Castor", con: "Gemini", ra: 7.577, dec: 31.89, mag: 1.6 },
  { name: "Pollux", con: "Gemini", ra: 7.755, dec: 28.03, mag: 1.1 },
  // Canis Major
  { name: "Sirius", con: "Canis Major", ra: 6.752, dec: -16.72, mag: -1.46 },
  { name: "Murzim", con: "Canis Major", ra: 6.378, dec: -17.96, mag: 2.0 },
  { name: "Wezen", con: "Canis Major", ra: 7.14, dec: -26.39, mag: 1.8 },
  { name: "Adhara", con: "Canis Major", ra: 6.977, dec: -28.97, mag: 1.5 },
  // Solo bright landmark stars
  { name: "Vega", con: "Lyra", ra: 18.615, dec: 38.78, mag: 0.0 },
  { name: "Arcturus", con: "Bootes", ra: 14.261, dec: 19.18, mag: -0.05 },
  { name: "Aldebaran", con: "Taurus", ra: 4.599, dec: 16.51, mag: 0.9 },
  { name: "Capella", con: "Auriga", ra: 5.278, dec: 46.0, mag: 0.08 },
];

export const CONSTELLATION_LINES = [
  ["Dubhe", "Merak"], ["Merak", "Phecda"], ["Phecda", "Megrez"], ["Megrez", "Dubhe"],
  ["Megrez", "Alioth"], ["Alioth", "Mizar"], ["Mizar", "Alkaid"],
  ["Polaris", "Kochab"], ["Kochab", "Pherkad"],
  ["Betelgeuse", "Alnitak"], ["Bellatrix", "Mintaka"], ["Mintaka", "Alnilam"],
  ["Alnilam", "Alnitak"], ["Alnitak", "Saiph"], ["Mintaka", "Rigel"],
  ["Caph", "Schedar"], ["Schedar", "Tsih"], ["Tsih", "Ruchbah"], ["Ruchbah", "Segin"],
  ["Regulus", "Algieba"], ["Algieba", "Zosma"], ["Zosma", "Denebola"], ["Denebola", "Regulus"],
  ["Deneb", "Sadr"], ["Sadr", "Albireo"], ["Fawaris", "Sadr"], ["Sadr", "Gienah"],
  ["Dschubba", "Graffias"], ["Dschubba", "Antares"], ["Antares", "Shaula"], ["Shaula", "Sargas"],
  ["Castor", "Pollux"],
  ["Murzim", "Sirius"], ["Sirius", "Wezen"], ["Wezen", "Adhara"],
];

const DEG2RAD = Math.PI / 180;

/** Real current altitude/azimuth for every star, from a given lat/lon. */
export function computeStarHorizonPositions(date, lat, lon) {
  const observer = new Astronomy.Observer(lat, lon, 0);
  const time = Astronomy.MakeTime(date);
  return STARS.map((star) => {
    const hor = Astronomy.Horizon(time, observer, star.ra, star.dec, "normal");
    return { ...star, altitude: hor.altitude, azimuth: hor.azimuth };
  });
}

/** Alt/az (degrees, azimuth from North through East) -> unit direction vector. */
export function altAzToDirection(altitudeDeg, azimuthDeg) {
  const alt = altitudeDeg * DEG2RAD;
  const az = azimuthDeg * DEG2RAD;
  const cosAlt = Math.cos(alt);
  return { x: cosAlt * Math.sin(az), y: Math.sin(alt), z: -cosAlt * Math.cos(az) };
}
