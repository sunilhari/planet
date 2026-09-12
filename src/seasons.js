import * as Astronomy from "astronomy-engine";

/** Real equinox/solstice dates for a given year, via astronomy-engine. */
export function getSeasonDates(year) {
  const s = Astronomy.Seasons(year);
  return [
    { key: "mar", label: "Spring (N) / Fall (S)", date: s.mar_equinox.date, caption: "Neither pole leans toward the Sun — day and night are about equal everywhere." },
    { key: "jun", label: "Summer (N) / Winter (S)", date: s.jun_solstice.date, caption: "The North Pole leans toward the Sun — summer in the north, winter in the south." },
    { key: "sep", label: "Fall (N) / Spring (S)", date: s.sep_equinox.date, caption: "Neither pole leans toward the Sun — day and night are about equal everywhere." },
    { key: "dec", label: "Winter (N) / Summer (S)", date: s.dec_solstice.date, caption: "The South Pole leans toward the Sun — summer in the south, winter in the north." },
  ];
}
