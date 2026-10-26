/* Shared demo helpers: the back-to-gallery bar, reduced-motion flag and generated artwork.
   Effects never depend on the bar; `Demo.art()` is only used where a demo needs an image. */
(function () {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function injectBar() {
    if (window.top !== window && new URLSearchParams(location.search).has("preview")) return;
    const file = location.pathname.split("/").pop() || "";
    const num = (file.match(/^(\d+)/) || [])[1];
    const bar = document.createElement("nav");
    bar.className = "demo-bar";
    bar.setAttribute("aria-label", "Demo navigation");
    bar.innerHTML =
      '<a href="../../index.html" aria-label="Back to gallery">← Gallery</a>' +
      (num ? '<span class="demo-num">#' + num + "</span>" : "") +
      '<span class="demo-title"></span>';
    bar.querySelector(".demo-title").textContent = document.title;
    document.body.appendChild(bar);
  }

  // Seeded PRNG so generated art is stable between reloads.
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
  }

  const PALETTES = [
    ["#0f172a", "#7c3aed", "#f472b6", "#fde68a"],
    ["#04131f", "#0ea5e9", "#22d3ee", "#f0fdfa"],
    ["#1a0b05", "#ea580c", "#facc15", "#fff7ed"],
    ["#06140d", "#16a34a", "#a3e635", "#ecfccb"],
    ["#140616", "#db2777", "#fb7185", "#ffe4e6"],
    ["#0b0b14", "#4f46e5", "#a78bfa", "#e0e7ff"],
  ];

  // Procedural "landscape" artwork drawn on a canvas. Safe for WebGL textures, even over file://.
  function art(w, h, seed) {
    seed = seed == null ? 1 : seed;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    const r = rng(seed * 9301 + 49297);
    const p = PALETTES[seed % PALETTES.length];
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, p[0]); sky.addColorStop(0.6, p[1]); sky.addColorStop(1, p[2]);
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    // sun
    const sx = w * (0.25 + r() * 0.5), sy = h * (0.25 + r() * 0.2), sr = Math.min(w, h) * (0.1 + r() * 0.08);
    const sun = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 3);
    sun.addColorStop(0, p[3]); sun.addColorStop(0.3, p[3] + "cc"); sun.addColorStop(1, p[3] + "00");
    g.fillStyle = sun; g.fillRect(0, 0, w, h);
    g.fillStyle = p[3]; g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    // mountain layers
    for (let layer = 0; layer < 4; layer++) {
      const base = h * (0.55 + layer * 0.12);
      g.fillStyle = mix(p[1], p[0], 0.35 + layer * 0.2);
      g.beginPath(); g.moveTo(0, h);
      let y = base;
      for (let x = 0; x <= w; x += w / 24) {
        y = base - Math.abs(Math.sin(x * 0.004 * (layer + 1) + seed + layer) * h * 0.18 * (1 - layer * 0.18)) - r() * h * 0.02;
        g.lineTo(x, y);
      }
      g.lineTo(w, h); g.closePath(); g.fill();
    }
    return c;
  }

  function mix(a, b, t) {
    const pa = hex(a), pb = hex(b);
    return "rgb(" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",") + ")";
  }
  function hex(h) { h = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }

  function artURL(w, h, seed) { return art(w, h, seed).toDataURL("image/jpeg", 0.88); }

  const WORDS = ("motion light layer depth scroll pixel shader gradient rhythm texture surface signal canvas " +
    "orbit frame pulse wave grain glow drift field form space color noise curve flow detail craft").split(" ");
  // Deterministic filler copy for demo pages.
  function lorem(words, seed) {
    const r = rng(seed || 7);
    const out = [];
    for (let i = 0; i < words; i++) out.push(WORDS[Math.floor(r() * WORDS.length)]);
    const s = out.join(" ");
    return s.charAt(0).toUpperCase() + s.slice(1) + ".";
  }

  window.Demo = { reduced, art, artURL, rng, lorem, palettes: PALETTES };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectBar);
  else injectBar();
})();
