import { SPEED_PRESETS, DEFAULT_SPEED_INDEX, SCALE_MODES, DEFAULT_SCALE_MODE, QUALITY } from "../config.js";

/**
 * Builds the on-screen control panel and wires simple callbacks. Kept as
 * plain DOM (no framework) since this is a small, static control surface.
 */
export function buildControls({ onSpeedChange, onScaleChange, onPlayPause, onToggleLabels, onToggleOrbits, onToggleExplore }) {
  const root = document.createElement("div");
  root.className = "controls";
  root.innerHTML = `
    <button class="ctrl-btn" data-action="playpause" aria-label="Play or pause">⏸</button>

    <div class="ctrl-group">
      <label>Speed</label>
      <input type="range" min="0" max="${SPEED_PRESETS.length - 1}" step="1" value="${DEFAULT_SPEED_INDEX}" data-action="speed" />
      <span class="ctrl-value" data-role="speed-label">${SPEED_PRESETS[DEFAULT_SPEED_INDEX].label}</span>
    </div>

    <button class="ctrl-btn ctrl-btn--text" data-action="scale">${SCALE_MODES[DEFAULT_SCALE_MODE].label}</button>
    <button class="ctrl-btn ctrl-btn--text" data-action="labels">Labels: On</button>
    <button class="ctrl-btn ctrl-btn--text" data-action="orbits">Orbits: On</button>
    <button class="ctrl-btn ctrl-btn--text" data-action="explore">🔭 Explore</button>
    <span class="ctrl-quality">${QUALITY === "trim" ? "Pi mode" : "Full quality"}</span>
  `;
  document.body.appendChild(root);

  let playing = true;
  let scaleKey = DEFAULT_SCALE_MODE;
  let labelsOn = true;
  let orbitsOn = true;

  const playBtn = root.querySelector('[data-action="playpause"]');
  playBtn.addEventListener("click", (e) => {
    playing = !playing;
    e.target.textContent = playing ? "⏸" : "▶";
    onPlayPause(playing);
  });

  const speedInput = root.querySelector('[data-action="speed"]');
  const speedLabel = root.querySelector('[data-role="speed-label"]');
  speedInput.addEventListener("input", (e) => {
    const preset = SPEED_PRESETS[Number(e.target.value)];
    speedLabel.textContent = preset.label;
    onSpeedChange(preset.daysPerSecond);
  });

  root.querySelector('[data-action="scale"]').addEventListener("click", (e) => {
    scaleKey = scaleKey === "storybook" ? "true" : "storybook";
    e.target.textContent = SCALE_MODES[scaleKey].label;
    onScaleChange(SCALE_MODES[scaleKey]);
  });

  root.querySelector('[data-action="labels"]').addEventListener("click", (e) => {
    labelsOn = !labelsOn;
    e.target.textContent = `Labels: ${labelsOn ? "On" : "Off"}`;
    onToggleLabels(labelsOn);
  });

  root.querySelector('[data-action="orbits"]').addEventListener("click", (e) => {
    orbitsOn = !orbitsOn;
    e.target.textContent = `Orbits: ${orbitsOn ? "On" : "Off"}`;
    onToggleOrbits(orbitsOn);
  });

  root.querySelector('[data-action="explore"]').addEventListener("click", () => onToggleExplore());

  // Hide/show the whole panel with 'c' so it stays out of the way during
  // the actual show; a small tab in the corner brings it back.
  const tab = document.createElement("button");
  tab.className = "controls-tab";
  tab.textContent = "⚙";
  tab.setAttribute("aria-label", "Show controls");
  document.body.appendChild(tab);

  function setVisible(visible) {
    root.classList.toggle("controls--hidden", !visible);
    tab.classList.toggle("controls-tab--hidden", visible);
  }
  tab.addEventListener("click", () => setVisible(true));
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "c") setVisible(root.classList.contains("controls--hidden"));
    if (e.key === " ") playBtn.click();
  });

  /** Lets remote-control messages (or code) drive the same UI state as a click would. */
  function triggerAction(action, value) {
    if (action === "playpause") playBtn.click();
    else if (action === "speed") {
      speedInput.value = String(value);
      speedInput.dispatchEvent(new Event("input"));
    } else if (action === "scale") root.querySelector('[data-action="scale"]').click();
    else if (action === "labels") root.querySelector('[data-action="labels"]').click();
    else if (action === "orbits") root.querySelector('[data-action="orbits"]').click();
    else if (action === "explore") root.querySelector('[data-action="explore"]').click();
  }

  return { root, setVisible, triggerAction };
}

export function buildToast() {
  const el = document.createElement("div");
  el.className = "toast toast--hidden";
  document.body.appendChild(el);
  let hideTimer = null;

  function show(text, ms = 6000) {
    el.textContent = text;
    el.classList.remove("toast--hidden");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => el.classList.add("toast--hidden"), ms);
  }

  return { show };
}

export function buildFocusOverlay({ onExit }) {
  const root = document.createElement("div");
  root.className = "focus-overlay focus-overlay--hidden";
  root.innerHTML = `
    <button class="focus-overlay__back" data-action="back">← Back to Solar System</button>
    <div class="focus-overlay__card">
      <div class="focus-overlay__name" data-role="name"></div>
      <div class="focus-overlay__temp" data-role="temp"></div>
      <div class="focus-overlay__status" data-role="status"></div>
      <div class="focus-overlay__extra" data-role="extra"></div>
      <div class="focus-overlay__fact" data-role="fact"></div>
    </div>
  `;
  document.body.appendChild(root);
  root.querySelector('[data-action="back"]').addEventListener("click", () => onExit());

  const nameEl = root.querySelector('[data-role="name"]');
  const tempEl = root.querySelector('[data-role="temp"]');
  const statusEl = root.querySelector('[data-role="status"]');
  const extraEl = root.querySelector('[data-role="extra"]');
  const factEl = root.querySelector('[data-role="fact"]');

  function show({ name, funFact, color, tempC }) {
    nameEl.textContent = name;
    nameEl.style.color = color;
    tempEl.textContent =
      tempC === undefined ? "" : `🌡️ ${Math.round(tempC)}°C (${Math.round((tempC * 9) / 5 + 32)}°F) average`;
    factEl.textContent = funFact;
    statusEl.textContent = "";
    extraEl.innerHTML = "";
    root.classList.remove("focus-overlay--hidden");
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function setExtraHTML(html) {
    extraEl.innerHTML = html;
  }

  function hide() {
    root.classList.add("focus-overlay--hidden");
  }

  return { show, hide, setStatus, setExtraHTML, get isVisible() { return !root.classList.contains("focus-overlay--hidden"); } };
}

export function buildExplorePanel(handlers) {
  const {
    onSeasonPick,
    onToggleCompare,
    onWeightSubmit,
    onAgeSubmit,
    onSkyTonight,
    onTourToggle,
    onSoundToggle,
    onReadAloudToggle,
    onToggleNightSky,
    onQuizStart,
  } = handlers;

  const root = document.createElement("div");
  root.className = "explore-panel explore-panel--hidden";
  root.innerHTML = `
    <div class="explore-panel__header">🔭 Explore <button class="explore-panel__close" aria-label="Close">×</button></div>

    <section class="explore-section">
      <h3>🍂 Seasons</h3>
      <p class="explore-section__hint">Earth's tilt never changes — see how that alone makes the seasons.</p>
      <div class="explore-row" data-role="seasons"></div>
    </section>

    <section class="explore-section">
      <h3>📏 Compare Sizes</h3>
      <button class="explore-btn" data-action="compare">Line up all the planets</button>
    </section>

    <section class="explore-section">
      <h3>⚖️ My Weight on Other Planets</h3>
      <div class="explore-row">
        <input type="number" min="1" placeholder="Weight (lb)" class="explore-input" data-role="weight-input" />
        <button class="explore-btn" data-action="weight">Go!</button>
      </div>
      <div class="explore-results" data-role="weight-results"></div>
    </section>

    <section class="explore-section">
      <h3>🎂 My Age on Other Planets</h3>
      <div class="explore-row">
        <input type="number" min="0" max="120" placeholder="Your age" class="explore-input" data-role="age-input" />
        <button class="explore-btn" data-action="age">Go!</button>
      </div>
      <div class="explore-results" data-role="age-results"></div>
    </section>

    <section class="explore-section">
      <h3>🌃 Sky Tonight</h3>
      <button class="explore-btn" data-action="sky">What planets can we see tonight?</button>
      <div class="explore-results" data-role="sky-results"></div>
    </section>

    <section class="explore-section">
      <h3>🌌 Night Sky</h3>
      <p class="explore-section__hint">See the real stars and constellations above you right now.</p>
      <button class="explore-btn" data-action="nightsky">Show tonight's sky</button>
    </section>

    <section class="explore-section">
      <h3>🎯 Quiz</h3>
      <p class="explore-section__hint">Can you find the planet we describe?</p>
      <button class="explore-btn" data-action="quiz">Start Quiz</button>
    </section>

    <section class="explore-section">
      <h3>🎬 Guided Tour</h3>
      <button class="explore-btn" data-action="tour">Start Tour</button>
    </section>

    <section class="explore-section">
      <h3>🗣️ Read Facts Aloud</h3>
      <button class="explore-btn" data-action="readaloud">Read Aloud: On</button>
    </section>

    <section class="explore-section">
      <h3>🔊 Sound</h3>
      <button class="explore-btn" data-action="sound">Sound: Off</button>
    </section>
  `;
  document.body.appendChild(root);

  root.querySelector(".explore-panel__close").addEventListener("click", () => setVisible(false));

  const seasonsRow = root.querySelector('[data-role="seasons"]');
  function setSeasons(seasons) {
    seasonsRow.innerHTML = seasons
      .map((s) => `<button class="explore-btn explore-btn--small" data-season="${s.key}">${s.label.split(" ")[0]}</button>`)
      .join("");
    seasonsRow.querySelectorAll("[data-season]").forEach((btn) => {
      btn.addEventListener("click", () => onSeasonPick(btn.dataset.season));
    });
  }

  const compareBtn = root.querySelector('[data-action="compare"]');
  compareBtn.addEventListener("click", () => onToggleCompare());
  function setCompareLabel(text) {
    compareBtn.textContent = text;
  }

  const weightInput = root.querySelector('[data-role="weight-input"]');
  const weightResults = root.querySelector('[data-role="weight-results"]');
  root.querySelector('[data-action="weight"]').addEventListener("click", () => {
    const val = parseFloat(weightInput.value);
    if (!isFinite(val) || val <= 0) return;
    onWeightSubmit(val);
  });
  function setWeightResults(html) {
    weightResults.innerHTML = html;
  }

  const ageInput = root.querySelector('[data-role="age-input"]');
  const ageResults = root.querySelector('[data-role="age-results"]');
  root.querySelector('[data-action="age"]').addEventListener("click", () => {
    const val = parseFloat(ageInput.value);
    if (!isFinite(val) || val < 0) return;
    onAgeSubmit(val);
  });
  function setAgeResults(html) {
    ageResults.innerHTML = html;
  }

  const skyResults = root.querySelector('[data-role="sky-results"]');
  root.querySelector('[data-action="sky"]').addEventListener("click", () => onSkyTonight());
  function setSkyResults(html) {
    skyResults.innerHTML = html;
  }

  const tourBtn = root.querySelector('[data-action="tour"]');
  tourBtn.addEventListener("click", () => onTourToggle());
  function setTourLabel(text) {
    tourBtn.textContent = text;
  }

  const soundBtn = root.querySelector('[data-action="sound"]');
  soundBtn.addEventListener("click", () => onSoundToggle());
  function setSoundLabel(text) {
    soundBtn.textContent = text;
  }

  const readAloudBtn = root.querySelector('[data-action="readaloud"]');
  readAloudBtn.addEventListener("click", () => onReadAloudToggle());
  function setReadAloudLabel(text) {
    readAloudBtn.textContent = text;
  }

  const nightSkyBtn = root.querySelector('[data-action="nightsky"]');
  nightSkyBtn.addEventListener("click", () => onToggleNightSky());
  function setNightSkyLabel(text) {
    nightSkyBtn.textContent = text;
  }

  root.querySelector('[data-action="quiz"]').addEventListener("click", () => onQuizStart());

  function setVisible(visible) {
    root.classList.toggle("explore-panel--hidden", !visible);
  }
  function toggle() {
    setVisible(root.classList.contains("explore-panel--hidden"));
  }

  return {
    root,
    setVisible,
    toggle,
    setSeasons,
    setCompareLabel,
    setWeightResults,
    setAgeResults,
    setSkyResults,
    setTourLabel,
    setSoundLabel,
    setReadAloudLabel,
    setNightSkyLabel,
    get isVisible() { return !root.classList.contains("explore-panel--hidden"); },
  };
}

export function buildQuizHud({ onStop }) {
  const el = document.createElement("div");
  el.className = "quiz-hud quiz-hud--hidden";
  el.innerHTML = `
    <div class="quiz-hud__clue" data-role="clue"></div>
    <div class="quiz-hud__score" data-role="score"></div>
    <button class="quiz-hud__stop" data-action="stop">✕ End Quiz</button>
  `;
  document.body.appendChild(el);
  el.querySelector('[data-action="stop"]').addEventListener("click", () => onStop());

  const clueEl = el.querySelector('[data-role="clue"]');
  const scoreEl = el.querySelector('[data-role="score"]');

  function show() {
    el.classList.remove("quiz-hud--hidden");
  }
  function hide() {
    el.classList.add("quiz-hud--hidden");
  }
  function setClue(text) {
    clueEl.textContent = text;
  }
  function setScore(score, total) {
    scoreEl.textContent = `Score: ${score} / ${total}`;
  }
  function flashFeedback(correct) {
    el.classList.remove("quiz-hud--correct", "quiz-hud--wrong");
    void el.offsetWidth; // restart the CSS animation on repeated feedback
    el.classList.add(correct ? "quiz-hud--correct" : "quiz-hud--wrong");
  }

  return { show, hide, setClue, setScore, flashFeedback, get isVisible() { return !el.classList.contains("quiz-hud--hidden"); } };
}
