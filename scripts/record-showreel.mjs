// Renders showreel/index.html to an MP4, frame by frame.
// Chromium runs with virtual time and begin-frame control: each video frame advances the page
// clock by exactly 1/fps and then renders, so heavy shaders come out as smooth as light pages
// no matter how long a frame takes to draw.
//
// Usage: node scripts/record-showreel.mjs [--out showreel.mp4] [--from 1] [--to 250] [--jobs 3]
//        [--fps 30] [--scale 1] [--crf 18] [--sheet dir]   (--sheet saves stills at scene marks)
// Needs Playwright's chromium-headless-shell (or set CHROME_BIN) and ffmpeg on PATH.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf("--" + name); return i < 0 ? def : argv[i + 1]; };
const OUT = opt("out", join(root, "showreel.mp4"));
const FROM = +opt("from", 1), TO = +opt("to", 250);
const FPS = +opt("fps", 30), SCALE = +opt("scale", 1), CRF = opt("crf", "18");
const JOBS = +opt("jobs", 1);
const SHEET = opt("sheet", "");
const EVERY = +opt("every", 0);
const EXTRA = opt("query", "");
// Pages lay out at 1280×720 CSS pixels and render at 1.5× into 1920×1080 frames, which frames
// the demos (designed for laptop screens) the way a visitor sees them.
const W = 1920, H = 1080, CSS_W = 1280, CSS_H = 720;

// --- Parallel mode: split at category boundaries, record segments, then concatenate ---------
if (JOBS > 1) {
  const win = {};
  new Function("window", readFileSync(join(root, "effects/manifest.js"), "utf8"))(win);
  const fx = win.EFFECTS.filter((e) => +e.num >= FROM && +e.num <= TO);
  const groups = [];
  for (const e of fx) { const g = groups.at(-1); if (g && g.cat === e.category) g.list.push(e); else groups.push({ cat: e.category, list: [e] }); }
  // greedy contiguous partition by effect count (heavier WebGL categories weigh double)
  const weight = (g) => g.list.length * (/webgl|backgrounds/.test(g.cat) ? 2 : 1);
  const total = groups.reduce((a, g) => a + weight(g), 0);
  const parts = [];
  let acc = 0, cur = [];
  for (const g of groups) {
    cur.push(g); acc += weight(g);
    if (acc >= (total / JOBS) * (parts.length + 1) && parts.length < JOBS - 1) { parts.push(cur); cur = []; }
  }
  if (cur.length) parts.push(cur);
  const dir = mkdtempSync(join(tmpdir(), "showreel-"));
  const segs = parts.map((p, i) => ({
    file: join(dir, `seg${i}.mp4`),
    from: +p[0].list[0].num, to: +p.at(-1).list.at(-1).num,
    query: [i > 0 ? "intro=0" : "", i < parts.length - 1 ? "outro=0" : ""].filter(Boolean).join("&"),
  }));
  console.log(segs.map((s) => `#${s.from}-#${s.to}`).join("  "));
  await Promise.all(segs.map((s, i) => new Promise((res, rej) => {
    const args = [fileURLToPath(import.meta.url), "--out", s.file, "--from", s.from, "--to", s.to, "--fps", FPS, "--scale", SCALE, "--crf", CRF, "--query", [s.query, EXTRA].filter(Boolean).join("&")];
    if (SHEET) args.push("--sheet", SHEET);
    const p = spawn(process.execPath, args.map(String), { stdio: ["ignore", "pipe", "inherit"] });
    p.stdout.on("data", (d) => process.stdout.write(String(d).replace(/^(?=.)/gm, `[${i}] `)));
    p.on("exit", (c) => (c ? rej(new Error("segment " + i + " failed")) : res()));
  })));
  writeFileSync(join(dir, "list.txt"), segs.map((s) => `file '${s.file}'`).join("\n"));
  await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", join(dir, "list.txt"), "-c", "copy", "-movflags", "+faststart", OUT]);
  rmSync(dir, { recursive: true, force: true });
  console.log("wrote " + OUT);
  process.exit(0);
}

function run(cmd, args) {
  return new Promise((res, rej) => spawn(cmd, args, { stdio: "inherit" }).on("exit", (c) => (c ? rej(new Error(cmd + " exited " + c)) : res())));
}

// --- Static server (frames must be same-origin with the stage, which file:// isn't) --------
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".wasm": "application/wasm" };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(root, path);
  if (file.endsWith("/")) file += "index.html";
  if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;

// --- Chromium over a bare CDP websocket --------------------------------------------------
function findChrome() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  const dir = existsSync(base) && readdirSync(base).filter((d) => d.startsWith("chromium_headless_shell")).sort().pop();
  if (!dir) throw new Error("chromium-headless-shell not found; set CHROME_BIN");
  return join(base, dir, "chrome-headless-shell-linux64", "chrome-headless-shell");
}
const profile = mkdtempSync(join(tmpdir(), "srchrome-"));
const chrome = spawn(findChrome(), [
  "--remote-debugging-port=0", "--user-data-dir=" + profile, "--no-first-run", "--no-sandbox", "--mute-audio",
  "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
  "--deterministic-mode", "--enable-begin-frame-control", "--run-all-compositor-stages-before-draw",
  "--disable-threaded-animation", "--disable-threaded-scrolling", "--disable-checker-imaging",
  "--disable-new-content-rendering-timeout", "--disable-image-animation-resync",
  "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars",
  // report a mouse (hover + fine pointer) so custom-cursor demos switch on
  "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
chrome.stderr.resume();
const portFile = join(profile, "DevToolsActivePort");
for (let i = 0; i < 400 && !existsSync(portFile); i++) await new Promise((r) => setTimeout(r, 50));
const [dport, dpath] = readFileSync(portFile, "utf8").trim().split("\n");
const ws = new WebSocket(`ws://127.0.0.1:${dport}${dpath}`);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let msgId = 0;
const pending = new Map(), listeners = new Set();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
    msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
  } else for (const l of listeners) l(msg);
};
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const once = (method) => new Promise((r) => { const l = (m) => { if (m.method === method) { listeners.delete(l); r(m.params); } }; listeners.add(l); });

const { targetId } = await send("Target.createTarget", { url: "about:blank", enableBeginFrameControl: true });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);

let scene = "intro", done = false, wantShot = [];
const errors = [];
listeners.add((m) => {
  if (m.sessionId !== sessionId) return;
  if (m.method === "Runtime.bindingCalled" && m.params.name === "__srEvent") {
    const ev = JSON.parse(m.params.payload);
    if (ev.type === "scene") { scene = ev.id; process.stdout.write(`#${ev.id} ${ev.title}  (${frames} frames, ${((Date.now() - t0) / 1000) | 0}s)\n`); }
    else if (ev.type === "mark" && SHEET) wantShot.push(`${ev.id}-${ev.at}`);
    else if (ev.type === "error") errors.push(`#${scene} ${ev.message}`);
    else if (ev.type === "done") done = true;
  } else if (m.method === "Runtime.exceptionThrown") {
    const d = m.params.exceptionDetails;
    errors.push(`#${scene} ${(d.exception && d.exception.description) || d.text}`.split("\n")[0]);
  }
});
await S("Runtime.enable");
await S("Page.enable");
await S("Runtime.addBinding", { name: "__srEvent" });
await S("Emulation.setDeviceMetricsOverride", { width: CSS_W, height: CSS_H, deviceScaleFactor: (W / CSS_W) * SCALE, mobile: false });
await S("Emulation.setFocusEmulationEnabled", { enabled: true });
await S("Emulation.setVirtualTimePolicy", { policy: "pause" });

const ffmpeg = SHEET ? null : spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  "-vf", `scale=${W}:${H}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-crf", CRF, "-r", String(FPS), "-movflags", "+faststart", OUT], { stdio: ["pipe", "inherit", "inherit"] });
if (SHEET) mkdirSync(SHEET, { recursive: true });

const dt = 1000 / FPS;
let ticks = Number(process.hrtime.bigint() / 1000000n), frames = 0, last = null;
const t0 = Date.now();
async function frame(shot) {
  const expired = once("Emulation.virtualTimeBudgetExpired");
  await S("Emulation.setVirtualTimePolicy", { policy: "advance", budget: dt });
  // A cross-document view transition needs a drawn frame before the navigation
  // commits, while virtual time stays paused until it does: don't wait forever.
  await Promise.race([expired, new Promise((r) => setTimeout(r, 3000))]);
  ticks += dt;
  const r = await S("HeadlessExperimental.beginFrame", { frameTimeTicks: ticks, interval: dt, ...(shot ? { screenshot: { format: "jpeg", quality: 92 } } : {}) });
  return r.screenshotData ? Buffer.from(r.screenshotData, "base64") : null;
}

const query = ["record", EXTRA, `from=${FROM}`, `to=${TO}`].filter(Boolean).join("&");
S("Page.navigate", { url: `http://127.0.0.1:${PORT}/showreel/index.html?${query}` });
const write = (buf) => new Promise((r) => (ffmpeg.stdin.write(buf) ? r() : ffmpeg.stdin.once("drain", r)));
const LIMIT = FPS * 60 * 40;
while (!done && frames < LIMIT) {
  const img = await frame(true);
  if (img) last = img;
  if (SHEET) {
    if (EVERY && frames % EVERY === 0) wantShot.push(`${scene}-f${String(frames).padStart(5, "0")}`);
    for (const name of wantShot.splice(0)) if (last) writeFileSync(join(SHEET, name + ".jpg"), last);
  }
  else if (last) await write(last);
  frames++;
}
if (ffmpeg) { ffmpeg.stdin.end(); await new Promise((r) => ffmpeg.on("exit", r)); }
ws.close(); chrome.kill(); server.close();
await new Promise((r) => (chrome.exitCode != null ? r() : chrome.on("exit", r)));
rmSync(profile, { recursive: true, force: true });
if (errors.length) console.log("page errors:\n  " + [...new Set(errors)].slice(0, 60).join("\n  "));
console.log(`${frames} frames (${(frames / FPS).toFixed(1)}s of video) in ${((Date.now() - t0) / 1000).toFixed(0)}s${ffmpeg ? " -> " + OUT : ""}`);
