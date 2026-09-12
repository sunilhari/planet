// Descriptive (not name-dropping) clues for the "spot it" quiz — a kid who
// can't read the planet names yet can still match a description to a look.
export const QUIZ_CLUES = {
  sun: "Click the big glowing star at the very center!",
  mercury: "Click the small, grey, cratered planet closest to the Sun!",
  venus: "Click the planet covered in swirly pale clouds — it's the hottest one!",
  earth: "Click the blue and green planet — that one is our home!",
  mars: "Click the rusty red planet!",
  jupiter: "Click the biggest planet, striped with a giant red spot!",
  saturn: "Click the planet with the big rings around it!",
  uranus: "Click the pale blue planet that spins on its side!",
  neptune: "Click the deep blue, windy planet!",
  moon: "Click the little grey moon next to Earth!",
};

export function shuffledKeys(keys) {
  const arr = [...keys];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
