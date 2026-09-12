/** Minimal auto-advancing sequencer for the "story mode" guided tour. */
export function createTour({ onStep, onEnd, stepDurationMs = 8000 }) {
  let timer = null;
  let running = false;
  let seq = [];
  let idx = 0;

  function playStep() {
    if (!running) return;
    if (idx >= seq.length) {
      stop();
      onEnd?.();
      return;
    }
    onStep(seq[idx], idx, seq.length);
    idx += 1;
    timer = setTimeout(playStep, stepDurationMs);
  }

  function start(sequence) {
    stop();
    seq = sequence;
    idx = 0;
    running = true;
    playStep();
  }

  function stop() {
    running = false;
    clearTimeout(timer);
  }

  return {
    start,
    stop,
    get isRunning() {
      return running;
    },
  };
}
