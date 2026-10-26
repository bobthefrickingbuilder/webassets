/* Small helpers for the Three.js demos (requires the global THREE from vendor/three/three.min.js).
   ThreeKit.app(opts)  -> { renderer, scene, camera, clock, onFrame(fn), start() } with resize handling.
   ThreeKit.orbit(camera, dom, opts) -> drag-to-orbit with inertia, wheel/pinch zoom and optional auto-rotate. */
(function () {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function app(opts) {
    opts = opts || {};
    const canvas = opts.canvas || document.querySelector("canvas");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: opts.antialias !== false, alpha: !!opts.alpha });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, opts.dpr || 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    if (opts.background != null) scene.background = new THREE.Color(opts.background);
    const camera = new THREE.PerspectiveCamera(opts.fov || 45, 1, opts.near || 0.1, opts.far || 1000);
    camera.position.set(...(opts.position || [0, 0, 5]));
    const clock = new THREE.Clock();
    const callbacks = [];

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    addEventListener("resize", resize);
    resize();

    function loop() {
      const dt = Math.min(clock.getDelta(), 1 / 20);
      const t = clock.elapsedTime;
      for (const cb of callbacks) cb(t, dt);
      renderer.render(scene, camera);
      if (!reduced || opts.alwaysAnimate) requestAnimationFrame(loop);
    }

    return {
      renderer, scene, camera, clock, reduced, resize,
      onFrame(fn) { callbacks.push(fn); return this; },
      start() { requestAnimationFrame(loop); if (reduced && !opts.alwaysAnimate) addEventListener("pointermove", () => requestAnimationFrame(loop)); return this; },
    };
  }

  function orbit(camera, dom, opts) {
    opts = opts || {};
    const target = opts.target || new THREE.Vector3();
    const offset = camera.position.clone().sub(target);
    const s = new THREE.Spherical().setFromVector3(offset);
    let vTheta = 0, vPhi = 0, dragging = false, lx = 0, ly = 0;
    const pointers = new Map();
    let pinch = 0;
    const minR = opts.minDistance || 1, maxR = opts.maxDistance || 50;
    let radius = s.radius;
    dom.style.touchAction = "none";
    dom.addEventListener("pointerdown", (e) => {
      pointers.set(e.pointerId, e);
      dragging = true; lx = e.clientX; ly = e.clientY; dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, e);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinch) radius = Math.min(maxR, Math.max(minR, radius * (pinch / d)));
        pinch = d; return;
      }
      if (!dragging) return;
      vTheta = -(e.clientX - lx) * 0.005; vPhi = -(e.clientY - ly) * 0.005;
      lx = e.clientX; ly = e.clientY;
    });
    const end = (e) => { pointers.delete(e.pointerId); pinch = 0; if (!pointers.size) dragging = false; };
    dom.addEventListener("pointerup", end); dom.addEventListener("pointercancel", end);
    if (opts.zoom !== false) dom.addEventListener("wheel", (e) => { e.preventDefault(); radius = Math.min(maxR, Math.max(minR, radius * (1 + e.deltaY * 0.001))); }, { passive: false });

    const api = {
      autoRotate: opts.autoRotate || 0,
      target,
      update() {
        s.theta += vTheta + (dragging ? 0 : api.autoRotate * (reduced ? 0 : 1));
        s.phi = Math.min(Math.PI - 0.05, Math.max(0.05, s.phi + vPhi));
        s.radius += (radius - s.radius) * 0.15;
        vTheta *= dragging ? 0 : 0.92; vPhi *= dragging ? 0 : 0.92;   // inertia after release
        camera.position.setFromSpherical(s).add(target);
        camera.lookAt(target);
      },
    };
    return api;
  }

  window.ThreeKit = { app, orbit };
})();
