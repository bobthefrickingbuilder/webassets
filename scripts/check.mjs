// Loads every effect page in headless Chromium, exercises it briefly (pointer, click, scroll)
// and reports uncaught errors and console errors.
// Usage: node scripts/check.mjs [filter]   e.g. node scripts/check.mjs 02-text
import { createRequire } from "node:module";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Playwright may be installed globally, which ESM import cannot resolve; require() can.
const { chromium } = createRequire(import.meta.url)("playwright");
const root = join(fileURLToPath(import.meta.url), "..", "..");
const filter = process.argv[2] || "";

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".html") ? [p] : [];
  });
}

const pages = [join(root, "index.html"), ...walk(join(root, "effects"))].filter((p) => p.includes(filter)).sort();
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
let failures = 0;

for (const file of pages) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/WebGPU|webgpu|GPU stall|favicon/i.test(m.text())) errors.push("console: " + m.text().slice(0, 300));
  });
  try {
    await page.goto(pathToFileURL(file).href, { waitUntil: "load", timeout: 15000 });
    await page.waitForTimeout(400);
    await page.mouse.move(400, 300);
    await page.mouse.move(700, 450, { steps: 8 });
    await page.mouse.down();
    await page.mouse.move(720, 470, { steps: 3 });
    await page.mouse.up();
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(500);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(200);
  } catch (e) {
    errors.push("load: " + e.message.split("\n")[0]);
  }
  const rel = file.slice(root.length + 1);
  if (errors.length) {
    failures++;
    console.log("FAIL " + rel + "\n  " + [...new Set(errors)].join("\n  "));
  } else if (process.env.VERBOSE) console.log("ok   " + rel);
  await page.close();
}

await browser.close();
console.log(`\n${pages.length - failures}/${pages.length} pages clean`);
process.exit(failures ? 1 : 0);
