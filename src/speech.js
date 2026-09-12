// Reads facts aloud via the browser's built-in speech synthesis — no audio
// files, works fully offline, and is the main way a 5-year-old who can't
// read yet gets at the content in the fact cards.
let enabled = true;
let voice = null;

function pickVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  // Prefer an English voice; fall back to whatever the browser/OS offers.
  voice = voices.find((v) => /en[-_]/i.test(v.lang)) || voices[0] || null;
}

if ("speechSynthesis" in window) {
  pickVoice();
  window.speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
}

export function setReadAloudEnabled(on) {
  enabled = on;
  if (!on) window.speechSynthesis?.cancel();
}

export function isReadAloudEnabled() {
  return enabled;
}

export function speak(text) {
  if (!enabled || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel(); // don't let facts pile up/overlap
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.95;
  utter.pitch = 1.05;
  if (voice) utter.voice = voice;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel();
}
