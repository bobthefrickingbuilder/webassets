# Web Assets

250 self-contained website animations and interactive features, from smooth scroll effects to WebGPU particles, with a browsable gallery.

Open `index.html` in a browser to explore them. There's no build step and no install. Every effect is a single HTML file you can open directly (`file://` works) or copy into a project.

## Layout

```
index.html               Gallery: search, category filters, live hover previews
showreel/                Auto-playing showreel: a scripted cursor demonstrates every effect
effects/
  manifest.js            Generated index of every effect (see scripts/)
  01-scroll/ … 13-components/   One HTML file per effect, numbered 001–250
assets/
  demo.css, demo.js      Shared page chrome, design tokens and helpers (Demo.art, Demo.lorem, Demo.rng, Demo.reduced)
  gl.js                  Tiny WebGL2 helper: full-screen shaders, ping-pong targets
  fluid.js               Stable-fluids solver shared by the fluid demos
  three-kit.js           Three.js app/orbit/studio-environment helpers
  physics2d.js           Small 2D rigid-body engine (boxes, circles, SAT, impulses, mouse joint)
  world.js               Simplified world map data for the globe and map demos
  vendor/three/          Three.js r160 (MIT), loaded as a classic script
  fonts/                 Roboto Flex variable font (OFL)
scripts/
  build-manifest.mjs     Rebuilds effects/manifest.js from each page's <title>/<meta> tags
  check.mjs              Loads every page in headless Chromium, interacts with it and reports errors
  shot.mjs               Screenshots a page
  record-showreel.mjs    Renders the showreel to an MP4, frame by frame
```

| # | Category | Count |
|---|----------|------:|
| 001–026 | Scroll | 26 |
| 027–054 | Text & Typography | 28 |
| 055–072 | Cursor & Pointer | 18 |
| 073–094 | Buttons & Micro-interactions | 22 |
| 095–120 | Backgrounds & Heroes | 26 |
| 121–140 | Cards, Images & Galleries | 20 |
| 141–156 | Transitions & Navigation | 16 |
| 157–168 | Loaders & Progress | 12 |
| 169–184 | SVG, CSS & Filters | 16 |
| 185–202 | WebGL / WebGPU / 3D | 18 |
| 203–216 | Physics & Play | 14 |
| 217–236 | Exotic & Experimental | 20 |
| 237–250 | Animated UI Components | 14 |

`FEATURE_CATALOG.md` is the original research list these were built from.

## Showreel

`showreel/index.html` plays every effect in turn. A scripted fake cursor hovers, clicks, drags, scrolls and types so each interaction is shown, with a title card per category and a caption naming each effect. The scripts live in `showreel/scenes.js`, one entry per effect. `showreel/driver.js` turns them into synthetic pointer, wheel and keyboard events.

The showreel drives each demo inside a same-origin frame, so serve the repository over HTTP:

```
python3 -m http.server      # then open http://localhost:8000/showreel/
```

Space pauses, ← and → step between effects, and the menu jumps to a category. Use `?start=120` to begin at an effect, `?cat=10-webgl` to play one category, or `?only=73,85` to play a few effects.

To render it as a video, run `node scripts/record-showreel.mjs --out showreel.mp4 --jobs 3`. Chromium renders with virtual time, one frame per 1/30 s, so heavy shaders stay smooth however long a frame takes to draw. `--jobs` splits the reel at category boundaries and renders the parts in parallel. This needs Playwright's `chromium-headless-shell` (or `CHROME_BIN`) and `ffmpeg`.

## Conventions

- Each page declares its own metadata (`<title>`, `description`, `tech`, `complexity` meta tags), so the manifest stays in sync automatically.
- Every effect respects `prefers-reduced-motion`. It either shows a static or settled state, or tones the motion down.
- Images are generated at runtime (`Demo.art`), so there are no binary assets to license and textures stay CORS-safe over `file://`.
- Effects that need hardware or permissions (camera, mic, gyroscope, gamepad, WebGPU, speech) only ask after a user gesture and fall back to a simulated source when the hardware or permission isn't available.

## Adding an effect

1. Copy a page in the matching category folder and give it the next number.
2. Update its `<title>` and meta tags.
3. Run `node scripts/build-manifest.mjs`.
4. Optionally run `node scripts/check.mjs <filter>` to smoke-test it. This needs Playwright and Chromium.
