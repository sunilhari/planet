/**
 * WebSocket client for the main display. Only does anything when the app is
 * served by server.js (same origin gets a WS relay); under `vite dev` there's
 * no server to connect to, so this just retries quietly in the background.
 * Returns a `send` function so the display can push state back to the phone
 * remote (e.g. so its Sound/Read Aloud/Auto-Spin buttons reflect reality).
 */
export function connectRemote(onMessage) {
  if (!("WebSocket" in window)) return { send: () => {} };
  const proto = location.protocol === "https:" ? "wss" : "ws";
  let ws;
  let retryTimer = null;

  function connect() {
    try {
      ws = new WebSocket(`${proto}://${location.host}`);
    } catch {
      scheduleRetry();
      return;
    }
    ws.addEventListener("message", (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch {
        /* ignore malformed messages */
      }
    });
    ws.addEventListener("close", scheduleRetry);
    ws.addEventListener("error", () => ws.close());
  }

  function scheduleRetry() {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, 3000);
  }

  function send(msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  connect();
  return { send };
}
