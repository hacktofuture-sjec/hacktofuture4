const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

const SERVE_DIR = "/app/public";
fs.mkdirSync(SERVE_DIR, { recursive: true });
fs.writeFileSync(`${SERVE_DIR}/readme.txt`, "Welcome to the file server.");

let PATCHED = false;   // flipped by Blue's live-patch

// Logging middleware
app.use((req, res, next) => {
  console.log(JSON.stringify({
    event: "request", method: req.method,
    path: req.path, query: req.query,
    ip: req.ip, service: "node-pathtraversal",
    ts: Date.now()
  }));
  next();
});

// !! VULNERABLE: no path.resolve/normalize, no chroot check !!
app.get("/files", (req, res) => {
  const filePath = req.query.path || "readme.txt";
  const target = path.join(SERVE_DIR, filePath);

  // PATCHED: enforce that resolved path stays within SERVE_DIR
  if (PATCHED) {
    const resolved = path.resolve(SERVE_DIR, filePath);
    if (!resolved.startsWith(SERVE_DIR)) {
      return res.status(403).json({ error: "Path traversal blocked by patch", path: filePath });
    }
  }

  try {
    const content = fs.readFileSync(target, "utf8");
    res.type("text").send(content);
  } catch (e) {
    res.status(404).json({ error: "File not found", path: filePath });
  }
});

// Admin patch endpoint — Blue calls this to fix the vulnerability
app.post("/admin/patch", express.json(), (req, res) => {
  PATCHED = true;
  console.log("[PATCH] Path traversal vulnerability patched — path.resolve guard enabled");
  res.json({ status: "patched", service: "node-pathtraversal" });
});

app.get("/health", (_, res) => res.json({ status: "up", service: "node-pathtraversal" }));

app.listen(3001, () => console.log("node-pathtraversal running :3001"));