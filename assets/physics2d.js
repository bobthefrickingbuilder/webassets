/* A small 2D rigid-body engine for the physics demos: rotating boxes and circles with SAT contact
   clipping, sequential impulses (restitution + Coulomb friction), positional correction and a soft
   mouse joint. Units are CSS pixels, y points down.
   const w = P2D.world({ gravity: 1800 });
   w.box(x, y, width, height, { static, angle, restitution, friction, density, data })
   w.circle(x, y, r, opts) · w.walls(width, height) · w.step(dt) · w.pick(x, y) · w.grab(body, x, y) · w.drag(x, y) · w.release() */
(function () {
  const cross = (ax, ay, bx, by) => ax * by - ay * bx;

  function makeBody(shape, x, y, opts) {
    opts = opts || {};
    const b = {
      shape, x, y, a: opts.angle || 0, vx: opts.vx || 0, vy: opts.vy || 0, w: opts.w || 0,
      restitution: opts.restitution ?? 0.2, friction: opts.friction ?? 0.5, static: !!opts.static, data: opts.data, verts: null,
    };
    const density = opts.density || 0.001;
    let m, I;
    if (shape.type === "circle") { m = Math.PI * shape.r * shape.r * density; I = 0.5 * m * shape.r * shape.r; }
    else { const w = shape.hw * 2, h = shape.hh * 2; m = w * h * density; I = (m * (w * w + h * h)) / 12; }
    b.m = m; b.invM = b.static ? 0 : 1 / m; b.invI = b.static || opts.fixedRotation ? 0 : 1 / I;
    return b;
  }

  function updateVerts(b) {
    if (b.shape.type !== "box") return;
    const c = Math.cos(b.a), s = Math.sin(b.a), { hw, hh } = b.shape;
    const local = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    b.verts = local.map(([x, y]) => [b.x + x * c - y * s, b.y + x * s + y * c]);
    b.normals = [0, 1, 2, 3].map((i) => {
      const p = b.verts[i], q = b.verts[(i + 1) % 4], ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey);
      return [ey / l, -ex / l];   // outward for this winding (screen space, y down)
    });
  }

  function bounds(b) {
    if (b.shape.type === "circle") { const r = b.shape.r; return [b.x - r, b.y - r, b.x + r, b.y + r]; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of b.verts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return [x0, y0, x1, y1];
  }

  // --- Narrow phase. Each returns null or { n: [x, y] pointing from A to B, points: [[x, y, depth], ...] } ---
  function circleCircle(A, B) {
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy), r = A.shape.r + B.shape.r;
    if (d >= r) return null;
    const n = d > 1e-6 ? [dx / d, dy / d] : [0, 1];
    return { n, points: [[A.x + n[0] * A.shape.r, A.y + n[1] * A.shape.r, r - d]] };
  }

  function boxCircle(A, B) {   // A box, B circle
    const c = Math.cos(A.a), s = Math.sin(A.a), dx = B.x - A.x, dy = B.y - A.y;
    const lx = dx * c + dy * s, ly = -dx * s + dy * c, { hw, hh } = A.shape, r = B.shape.r;
    const cx = Math.max(-hw, Math.min(hw, lx)), cy = Math.max(-hh, Math.min(hh, ly));
    let nlx, nly, depth, px = cx, py = cy;
    if (cx === lx && cy === ly) {   // centre inside the box: push out through the nearest face
      const fx = hw - Math.abs(lx), fy = hh - Math.abs(ly);
      if (fx < fy) { nlx = Math.sign(lx) || 1; nly = 0; depth = fx + r; px = nlx * hw; }
      else { nlx = 0; nly = Math.sign(ly) || 1; depth = fy + r; py = nly * hh; }
    } else {
      const ex = lx - cx, ey = ly - cy, d = Math.hypot(ex, ey);
      if (d >= r) return null;
      nlx = ex / d; nly = ey / d; depth = r - d;
    }
    const n = [nlx * c - nly * s, nlx * s + nly * c];
    return { n, points: [[A.x + px * c - py * s, A.y + px * s + py * c, depth]] };
  }

  function maxSeparation(A, B) {
    let best = -Infinity, idx = 0;
    for (let i = 0; i < 4; i++) {
      const [nx, ny] = A.normals[i], [vx, vy] = A.verts[i];
      let min = Infinity;
      for (const [x, y] of B.verts) min = Math.min(min, (x - vx) * nx + (y - vy) * ny);
      if (min > best) { best = min; idx = i; }
    }
    return { sep: best, idx };
  }

  function boxBox(A, B) {
    const sa = maxSeparation(A, B); if (sa.sep > 0) return null;
    const sb = maxSeparation(B, A); if (sb.sep > 0) return null;
    let ref = A, inc = B, i = sa.idx, flip = false;
    if (sb.sep > sa.sep + 0.5) { ref = B; inc = A; i = sb.idx; flip = true; }
    const n = ref.normals[i], v1 = ref.verts[i], v2 = ref.verts[(i + 1) % 4];
    // incident edge: the one on `inc` whose normal is most opposed to n
    let k = 0, minDot = Infinity;
    for (let j = 0; j < 4; j++) { const d = inc.normals[j][0] * n[0] + inc.normals[j][1] * n[1]; if (d < minDot) { minDot = d; k = j; } }
    let pts = [inc.verts[k], inc.verts[(k + 1) % 4]];
    const tx = v2[0] - v1[0], ty = v2[1] - v1[1], tl = Math.hypot(tx, ty), t = [tx / tl, ty / tl];
    const clip = (pts, nx, ny, off) => {   // keep the part of segment pts where dot(n, p) <= off
      const out = [], d0 = pts[0][0] * nx + pts[0][1] * ny - off, d1 = pts[1][0] * nx + pts[1][1] * ny - off;
      if (d0 <= 0) out.push(pts[0]); if (d1 <= 0) out.push(pts[1]);
      if (d0 * d1 < 0) { const f = d0 / (d0 - d1); out.push([pts[0][0] + f * (pts[1][0] - pts[0][0]), pts[0][1] + f * (pts[1][1] - pts[0][1])]); }
      return out;
    };
    pts = clip(pts, -t[0], -t[1], -(v1[0] * t[0] + v1[1] * t[1])); if (pts.length < 2) return null;
    pts = clip(pts, t[0], t[1], v2[0] * t[0] + v2[1] * t[1]); if (pts.length < 2) return null;
    const points = [];
    for (const p of pts) { const sep = (p[0] - v1[0]) * n[0] + (p[1] - v1[1]) * n[1]; if (sep <= 0) points.push([p[0], p[1], -sep]); }
    if (!points.length) return null;
    return { n: flip ? [-n[0], -n[1]] : [n[0], n[1]], points };
  }

  function collide(A, B) {
    const ta = A.shape.type, tb = B.shape.type;
    if (ta === "circle" && tb === "circle") return circleCircle(A, B);
    if (ta === "box" && tb === "box") return boxBox(A, B);
    if (ta === "box") return boxCircle(A, B);
    const m = boxCircle(B, A); if (m) m.n = [-m.n[0], -m.n[1]]; return m;
  }

  function world(opts) {
    opts = opts || {};
    const W = { bodies: [], gravity: opts.gravity ?? 1800, iterations: opts.iterations || 14, joint: null };
    W.add = (b) => { updateVerts(b); W.bodies.push(b); return b; };
    W.remove = (b) => { const i = W.bodies.indexOf(b); if (i >= 0) W.bodies.splice(i, 1); if (W.joint && W.joint.b === b) W.joint = null; };
    W.box = (x, y, w, h, o) => W.add(makeBody({ type: "box", hw: w / 2, hh: h / 2 }, x, y, o));
    W.circle = (x, y, r, o) => W.add(makeBody({ type: "circle", r }, x, y, o));
    W.walls = (w, h, t = 200) => {
      (W._walls || []).forEach(W.remove);
      W._walls = [W.box(w / 2, h + t / 2, w + t * 2, t, { static: true }), W.box(-t / 2, h / 2 - h, t, h * 3, { static: true }), W.box(w + t / 2, h / 2 - h, t, h * 3, { static: true })];
      if (opts.ceiling) W._walls.push(W.box(w / 2, -t / 2, w + t * 2, t, { static: true }));
      return W._walls;
    };
    W.pick = (x, y) => {
      for (let i = W.bodies.length - 1; i >= 0; i--) {
        const b = W.bodies[i]; if (b.static) continue;
        if (b.shape.type === "circle") { if (Math.hypot(x - b.x, y - b.y) < b.shape.r) return b; continue; }
        const c = Math.cos(b.a), s = Math.sin(b.a), dx = x - b.x, dy = y - b.y;
        if (Math.abs(dx * c + dy * s) < b.shape.hw && Math.abs(-dx * s + dy * c) < b.shape.hh) return b;
      }
      return null;
    };
    // Mouse joint: remembers the grab point in body space and pulls it toward the pointer.
    W.grab = (b, x, y) => { const c = Math.cos(-b.a), s = Math.sin(-b.a), dx = x - b.x, dy = y - b.y; W.joint = { b, lx: dx * c - dy * s, ly: dx * s + dy * c, tx: x, ty: y }; };
    W.drag = (x, y) => { if (W.joint) { W.joint.tx = x; W.joint.ty = y; } };
    W.release = () => (W.joint = null);

    W.step = (dt) => {
      const B = W.bodies;
      for (const b of B) if (!b.static) { b.vy += W.gravity * dt; b.vx *= 0.9995; b.vy *= 0.9995; b.w *= 0.998; }
      if (W.joint) {
        const { b, lx, ly, tx, ty } = W.joint, c = Math.cos(b.a), s = Math.sin(b.a);
        const rx = lx * c - ly * s, ry = lx * s + ly * c, px = b.x + rx, py = b.y + ry;
        const vpx = b.vx - b.w * ry, vpy = b.vy + b.w * rx;
        const dvx = (tx - px) * 18 - vpx, dvy = (ty - py) * 18 - vpy;   // target velocity toward the pointer
        const kx = b.invM + b.invI * ry * ry, ky = b.invM + b.invI * rx * rx;
        const jx = (dvx / kx) * 0.35, jy = (dvy / ky) * 0.35;
        b.vx += jx * b.invM; b.vy += jy * b.invM; b.w += cross(rx, ry, jx, jy) * b.invI;
        b.w *= 0.95;
      }
      // Broad + narrow phase
      const contacts = [];
      const bb = B.map(bounds);
      for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
        const A = B[i], C = B[j];
        if (A.static && C.static) continue;
        const a = bb[i], c = bb[j];
        if (a[2] < c[0] || c[2] < a[0] || a[3] < c[1] || c[3] < a[1]) continue;
        const m = collide(A, C); if (!m) continue;
        for (const [px, py, depth] of m.points) {
          const rax = px - A.x, ray = py - A.y, rbx = px - C.x, rby = py - C.y, [nx, ny] = m.n;
          const rna = cross(rax, ray, nx, ny), rnb = cross(rbx, rby, nx, ny);
          const tx = -ny, ty = nx, rta = cross(rax, ray, tx, ty), rtb = cross(rbx, rby, tx, ty);
          const vn = (C.vx - C.w * rby - A.vx + A.w * ray) * nx + (C.vy + C.w * rbx - A.vy - A.w * rax) * ny;
          contacts.push({ A, B: C, nx, ny, tx, ty, rax, ray, rbx, rby, depth,
            kn: A.invM + C.invM + rna * rna * A.invI + rnb * rnb * C.invI,
            kt: A.invM + C.invM + rta * rta * A.invI + rtb * rtb * C.invI,
            // target separating speed: restitution for real impacts, plus a Baumgarte push-out for overlap
            bounce: Math.max(vn < -120 ? -Math.max(A.restitution, C.restitution) * vn : 0, Math.min(0.2 / dt * Math.max(depth - 0.5, 0), 600)),
            mu: Math.sqrt(A.friction * C.friction), jn: 0, jt: 0 });
        }
      }
      W.contacts = contacts;
      const apply = (c, jx, jy) => {
        const { A, B } = c;
        A.vx -= jx * A.invM; A.vy -= jy * A.invM; A.w -= cross(c.rax, c.ray, jx, jy) * A.invI;
        B.vx += jx * B.invM; B.vy += jy * B.invM; B.w += cross(c.rbx, c.rby, jx, jy) * B.invI;
      };
      for (let it = 0; it < W.iterations; it++) for (const c of contacts) {
        const { A, B } = c;
        const rvx = B.vx - B.w * c.rby - A.vx + A.w * c.ray, rvy = B.vy + B.w * c.rbx - A.vy - A.w * c.rax;
        // normal impulse (accumulated and clamped so contacts can only push)
        const vn = rvx * c.nx + rvy * c.ny;
        let dj = (-vn + c.bounce) / c.kn;
        const jn = Math.max(c.jn + dj, 0); dj = jn - c.jn; c.jn = jn;
        apply(c, c.nx * dj, c.ny * dj);
        // friction impulse, limited by the Coulomb cone
        const rvx2 = B.vx - B.w * c.rby - A.vx + A.w * c.ray, rvy2 = B.vy + B.w * c.rbx - A.vy - A.w * c.rax;
        const vt = rvx2 * c.tx + rvy2 * c.ty;
        let dt2 = -vt / c.kt;
        const max = c.mu * c.jn, jt = Math.max(-max, Math.min(max, c.jt + dt2)); dt2 = jt - c.jt; c.jt = jt;
        apply(c, c.tx * dt2, c.ty * dt2);
      }
      for (const b of B) if (!b.static) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt;
      }
      for (const b of B) updateVerts(b);
    };
    return W;
  }

  window.P2D = { world };
})();
