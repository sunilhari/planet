// Local-network-only server for the Pi/kiosk deployment. Serves the built
// app (run `npm run build` first) plus a phone-friendly /remote page, and
// relays remote-control messages between them over WebSocket. No internet,
// no accounts — everything stays on your home Wi-Fi.
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import { networkInterfaces } from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.static(path.join(__dirname, "dist")));
app.use("/remote", express.static(path.join(__dirname, "public/remote")));

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    // Our whole protocol is JSON text; relay as a text frame explicitly —
    // otherwise `ws` forwards the raw Buffer as a binary frame, which
    // browsers deliver as a Blob instead of a string and JSON.parse fails.
    const text = data.toString();
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === 1) client.send(text);
    }
  });
});

function localIPs() {
  const nets = networkInterfaces();
  const ips = [];
  for (const iface of Object.values(nets)) {
    for (const addr of iface || []) {
      if (addr.family === "IPv4" && !addr.internal) ips.push(addr.address);
    }
  }
  return ips;
}

const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
  console.log(`\nSolar system display: http://localhost:${PORT}`);
  for (const ip of localIPs()) {
    console.log(`  On your network:   http://${ip}:${PORT}`);
    console.log(`  Phone remote:      http://${ip}:${PORT}/remote`);
  }
  console.log("");
});
