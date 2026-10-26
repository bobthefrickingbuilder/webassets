// Screenshots an effect page for visual spot checks.
// Usage: node scripts/shot.mjs <page.html> <out.png> [scrollFraction=0] [waitMs=800] [width=1280] [height=800]
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const [file, out, frac = "0", wait = "800", w = "1280", h = "800"] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto(pathToFileURL(resolve(file)).href);
await page.waitForTimeout(300);
await page.mouse.move(+w * 0.6, +h * 0.45);
await page.evaluate((f) => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), +frac);
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
await browser.close();
