import * as Astronomy from "astronomy-engine";

const PHASE_NAMES = [
  "New Moon",
  "Waxing Crescent",
  "First Quarter",
  "Waxing Gibbous",
  "Full Moon",
  "Waning Gibbous",
  "Last Quarter",
  "Waning Crescent",
];

const PHASE_EMOJI = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];

/** Real moon phase for a date — angle 0-360 (0=new, 180=full), illuminated fraction, and a friendly name. */
export function getMoonPhaseInfo(date) {
  const time = Astronomy.MakeTime(date);
  const angleDeg = Astronomy.MoonPhase(time);
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, time);
  const idx = Math.floor(((angleDeg + 22.5) % 360) / 45);
  return {
    angleDeg,
    illumination: illum.phase_fraction,
    name: PHASE_NAMES[idx],
    emoji: PHASE_EMOJI[idx],
  };
}
