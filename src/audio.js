// Rich procedural "deep space" ambience — a sub-bass drone chord, a filtered
// brown-noise bed for a soft cosmic-wind feel, and sparse high shimmer tones
// through a cheap feedback-delay "reverb". Everything is synthesized live
// with the Web Audio API — no audio files, so the app stays fully offline.
let ctx = null;
let masterGain = null;
let reverbSend = null;
let nodes = []; // all live ambient nodes, torn down together on stop
let shimmerTimer = null;
let enabled = false;

function ensureContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/** A few seconds of looping brown noise (leaky-integrated white noise) — soft, low "wind" texture rather than a hiss. */
function makeNoiseBuffer(c, seconds = 4) {
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

/** Cheap spaciousness via two feedback delay lines instead of a convolver/IR file. */
function buildReverb(c, destination) {
  const send = c.createGain();
  send.gain.value = 0.5;
  const returnGain = c.createGain();
  returnGain.gain.value = 0.35;

  for (const time of [0.31, 0.47]) {
    const delay = c.createDelay(1.5);
    delay.delayTime.value = time;
    const feedback = c.createGain();
    feedback.gain.value = 0.4;
    const damp = c.createBiquadFilter();
    damp.type = "lowpass";
    damp.frequency.value = 2200;
    send.connect(delay);
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    damp.connect(returnGain);
  }

  returnGain.connect(destination);
  return send;
}

const SHIMMER_SCALE = [523.25, 587.33, 659.25, 783.99, 880, 987.77, 1174.66]; // high, twinkly pentatonic-ish set

function scheduleShimmer(c) {
  const delay = 3000 + Math.random() * 6000;
  shimmerTimer = setTimeout(() => {
    if (!enabled) return;
    playShimmer(c);
    scheduleShimmer(c);
  }, delay);
}

function playShimmer(c) {
  const freq = SHIMMER_SCALE[Math.floor(Math.random() * SHIMMER_SCALE.length)];
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;
  const gain = c.createGain();
  const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  if (pan) pan.pan.value = Math.random() * 1.6 - 0.8;

  const now = c.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.05, now + 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

  osc.connect(gain);
  const tail = pan ? (gain.connect(pan), pan) : gain;
  tail.connect(masterGain);
  tail.connect(reverbSend);

  osc.start(now);
  osc.stop(now + 3.3);
}

function startAmbient() {
  const c = ensureContext();
  masterGain = c.createGain();
  masterGain.gain.value = 0.0001;
  masterGain.connect(c.destination);
  masterGain.gain.exponentialRampToValueAtTime(0.22, c.currentTime + 3);

  reverbSend = buildReverb(c, masterGain);

  // --- cosmic wind: filtered brown noise, slowly breathing --------------
  const noise = c.createBufferSource();
  noise.buffer = makeNoiseBuffer(c);
  noise.loop = true;
  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 500;
  noiseFilter.Q.value = 0.5;
  const noiseLfo = c.createOscillator();
  noiseLfo.frequency.value = 0.04;
  const noiseLfoGain = c.createGain();
  noiseLfoGain.gain.value = 220;
  noiseLfo.connect(noiseLfoGain);
  noiseLfoGain.connect(noiseFilter.frequency);
  const noiseGain = c.createGain();
  noiseGain.gain.value = 0.5;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);
  noise.start();
  noiseLfo.start();
  nodes.push({
    stop: () => {
      noise.stop();
      noiseLfo.stop();
    },
  });

  // --- sub-bass drone chord, each voice breathing independently ---------
  const droneFreqs = [36.71, 55, 73.42]; // D1, A1, D2
  droneFreqs.forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.value = 0.16;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.03 + i * 0.017;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.07;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    osc.connect(g);
    g.connect(masterGain);
    osc.start();
    lfo.start();
    nodes.push({
      stop: () => {
        osc.stop();
        lfo.stop();
      },
    });
  });

  // --- soft detuned pad for a little harmonic warmth ---------------------
  for (const f of [220, 224]) {
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500;
    const g = c.createGain();
    g.gain.value = 0.02;
    osc.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    osc.start();
    nodes.push({ stop: () => osc.stop() });
  }

  scheduleShimmer(c);
}

function stopAmbient() {
  clearTimeout(shimmerTimer);
  shimmerTimer = null;
  const c = ctx;
  const g = masterGain;
  const liveNodes = nodes;
  nodes = [];
  masterGain = null;
  reverbSend = null;
  if (g && c) {
    const now = c.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(0.0001, now + 0.6);
    setTimeout(() => {
      for (const n of liveNodes) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
      g.disconnect();
    }, 700);
  }
}

export function setSoundEnabled(on) {
  if (on === enabled) return;
  enabled = on;
  if (on) startAmbient();
  else stopAmbient();
}

export function isSoundEnabled() {
  return enabled;
}

/** Short filtered sweep for camera focus transitions. */
export function playWhoosh() {
  if (!enabled) return;
  const c = ensureContext();
  const osc = c.createOscillator();
  osc.type = "sine";
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.7;

  const now = c.currentTime;
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(660, now + 0.4);
  filter.frequency.setValueAtTime(300, now);
  filter.frequency.exponentialRampToValueAtTime(2000, now + 0.4);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.55);
}
