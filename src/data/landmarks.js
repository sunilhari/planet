// Real landing coordinates for historic Moon and Mars missions. Selenographic
// / areocentric lat/lon, east-positive — approximate to a fraction of a
// degree, which is what matters for "there's a flag right there," not for
// matching the (already stylized, non-photographic) surface textures.
export const APOLLO_SITES = [
  { name: "Apollo 11", lat: 0.674, lon: 23.473, fact: "🚩 Apollo 11 — July 20, 1969. The first humans ever to walk on the Moon landed right here!" },
  { name: "Apollo 12", lat: -3.014, lon: -23.422, fact: "🚩 Apollo 12 — November 1969. The second Moon landing!" },
  { name: "Apollo 14", lat: -3.645, lon: -17.471, fact: "🚩 Apollo 14 — February 1971. The astronauts even hit golf balls here!" },
  { name: "Apollo 15", lat: 26.132, lon: 3.634, fact: "🚩 Apollo 15 — July 1971. First mission to drive a car on the Moon — the Lunar Rover!" },
  { name: "Apollo 16", lat: -8.973, lon: 15.499, fact: "🚩 Apollo 16 — April 1972. Explored the Moon's rocky highlands." },
  { name: "Apollo 17", lat: 20.191, lon: 30.772, fact: "🚩 Apollo 17 — December 1972. The last time humans walked on the Moon... so far!" },
];

export const MARS_ROVER_SITES = [
  { name: "Viking 1", lat: 22.48, lon: -49.97, fact: "🤖 Viking 1 — July 1976. The first spacecraft to land safely on Mars and send back pictures!" },
  { name: "Spirit", lat: -14.568, lon: 175.473, fact: "🤖 Spirit rover — landed January 2004, explored Mars for over 6 years!" },
  { name: "Curiosity", lat: -4.59, lon: 137.442, fact: "🤖 Curiosity rover — landed 2012 and is still exploring! It's about the size of a small car." },
  { name: "Perseverance", lat: 18.445, lon: 77.451, fact: "🤖 Perseverance rover — landed 2021, looking for signs of ancient life on Mars!" },
];
