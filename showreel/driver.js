/* Showreel input driver. A fake cursor glides over an effect loaded in a same-origin iframe and
   dispatches synthetic pointer, mouse, wheel and keyboard events into it, so every demo can be
   shown "being used" without a person at the controls.

   Synthetic events have no default actions, so the driver supplies the ones demos rely on:
   :hover / :active styling (mirrored into [sr-h] / [sr-a] attribute rules), pointer capture,
   focus on mousedown, wheel scrolling, text entry and range-slider dragging. */
(function () {
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  class Skip extends Error {}

  const CURSORS = {
    arrow: '<path d="M3 2l15 13h-8l4.6 8.6-3 1.6L7 16.6 3 21z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/>',
    hand: '<path d="M8 13V4.5a1.7 1.7 0 013.4 0V11l.1-1.6a1.7 1.7 0 013.4.2v1.6a1.7 1.7 0 013.4 0v1.4a1.7 1.7 0 013.2.6v4.3c0 3.9-2.8 6.5-6.6 6.5h-1.4c-2.4 0-3.7-.8-5-2.6L4.6 16a1.7 1.7 0 012.6-2.2z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/>',
    grab: '<path d="M6.5 12.5V9.2a1.6 1.6 0 013.2 0V11V7.6a1.6 1.6 0 013.2 0V11V8.2a1.6 1.6 0 013.2 0V11v-1.6a1.6 1.6 0 013.2 0v6c0 4.2-2.8 7.1-6.8 7.1h-1c-2.6 0-4-1-5.2-2.8l-2.6-4a1.6 1.6 0 012.6-1.9z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/>',
    text: '<path d="M9 3h2.5a2 2 0 012 2v14a2 2 0 01-2 2H9M18 3h-2.5a2 2 0 00-2 2v14a2 2 0 002 2H18" fill="none" stroke="#111" stroke-width="3.4" stroke-linecap="round"/><path d="M9 3h2.5a2 2 0 012 2v14a2 2 0 01-2 2H9M18 3h-2.5a2 2 0 00-2 2v14a2 2 0 002 2H18" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
    cross: '<path d="M13 2v22M2 13h22" stroke="#111" stroke-width="3.6"/><path d="M13 2v22M2 13h22" stroke="#fff" stroke-width="1.6"/>',
  };
  // Hotspot of each cursor glyph inside its 28×28 box.
  const HOT = { arrow: [3, 2], hand: [9, 3], grab: [12, 9], text: [13.5, 12], cross: [13, 13] };

  function cursorKind(css) {
    if (css === "none") return "none";
    if (css === "pointer") return "hand";
    if (css === "grab" || css === "grabbing" || css === "move") return "grab";
    if (css === "text" || css === "vertical-text") return "text";
    if (css === "crosshair" || css === "cell") return "cross";
    return "arrow";
  }

  const LABELS = { " ": "Space", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Enter: "⏎", Escape: "Esc", Backspace: "⌫", Shift: "⇧" };
  const KEYCODES = { Enter: 13, Escape: 27, " ": 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Tab: 9, Backspace: 8, Delete: 46, Shift: 16, Control: 17, Alt: 18, Meta: 91, Home: 36, End: 35, PageUp: 33, PageDown: 34 };
  function keyCode(k) {
    if (KEYCODES[k]) return KEYCODES[k];
    if (k.length === 1) return k.toUpperCase().charCodeAt(0);
    if (/^F\d+$/.test(k)) return 111 + +k.slice(1);
    return 0;
  }
  function code(k) {
    if (k === " ") return "Space";
    if (/^[a-z]$/i.test(k)) return "Key" + k.toUpperCase();
    if (/^\d$/.test(k)) return "Digit" + k;
    return { "/": "Slash", ".": "Period", ",": "Comma", "-": "Minus", "=": "Equal", "?": "Slash", "!": "Digit1" }[k] || k;
  }

  class Driver {
    constructor(stage) {
      this.stage = stage;
      this.x = innerWidth * 0.62;
      this.y = innerHeight * 0.7;
      this.buttons = 0;
      this.gen = 0;
      this.paused = false;
      this.hover = [];
      this.capture = null;
      this.kind = "arrow";
      this.hidden = false;
      this.el = document.createElement("div");
      this.el.className = "sr-cursor";
      this.el.innerHTML = '<svg width="28" height="28" viewBox="0 0 28 28"></svg>';
      this.hud = document.createElement("div");
      this.hud.className = "sr-keys";
      stage.append(this.el, this.hud);
      this.setKind("arrow");
      this.render();
    }

    // --- Lifecycle ---------------------------------------------------------------------------
    attach(iframe) {
      this.frame = iframe;
      this.hover = [];
      this.capture = null;
      this.buttons = 0;
      const prep = () => { try { this.prepare(); } catch (e) { console.warn("showreel: prepare failed", e); } };
      prep();
      // Navigation demos load a second page into the same frame; prepare that one too.
      iframe.addEventListener("load", prep);
    }

    get win() { return this.frame.contentWindow; }
    get doc() { return this.frame.contentDocument; }

    prepare() {
      const win = this.win, doc = this.doc;
      if (!doc || win.__srReady) return;
      win.__srReady = true;
      win.__showreel = true;
      // Mirror :hover and :active rules onto attributes the driver can toggle.
      const mirror = (list, parent) => {
        for (let i = list.length - 1; i >= 0; i--) {
          const r = list[i];
          if (r.cssRules && r.cssRules.length) mirror(r.cssRules, r);
          if (r.selectorText && /:hover|:active/.test(r.selectorText)) {
            const sel = r.selectorText.replace(/:hover/g, "[sr-h]").replace(/:active/g, "[sr-a]");
            const body = r.style.cssText + (r.cssRules && r.cssRules.length ? [...r.cssRules].map((c) => c.cssText).join("") : "");
            try { parent.insertRule(sel + "{" + body + "}", i + 1); } catch (e) { /* selector the parser rejects */ }
          }
        }
      };
      for (const s of doc.styleSheets) { try { mirror(s.cssRules, s); } catch (e) { /* cross-origin sheet */ } }
      // Pointer capture can't be granted to a synthetic pointer, so emulate it.
      const P = win.Element.prototype, d = this;
      P.setPointerCapture = function () { d.capture = this; this.dispatchEvent(new win.PointerEvent("gotpointercapture", { pointerId: 1, bubbles: true })); };
      P.releasePointerCapture = function () { if (d.capture === this) d.capture = null; };
      P.hasPointerCapture = function () { return d.capture === this; };
      try { win.focus(); } catch (e) {}
    }

    cancel() { this.gen++; this.buttons = 0; this.capture = null; }

    // Wait one animation frame; throws Skip if the scene was cancelled. Holds while paused.
    async tick(gen) {
      do {
        await new Promise((r) => requestAnimationFrame(r));
        if (gen !== this.gen) throw new Skip();
      } while (this.paused);
    }

    async sleep(ms, gen) {
      const end = performance.now() + ms;
      while (performance.now() < end) await this.tick(gen);
    }

    // --- Cursor rendering --------------------------------------------------------------------
    setKind(kind) {
      if (kind === this.kind && this.el.dataset.kind) return;
      this.kind = kind;
      this.el.dataset.kind = kind;
      if (kind !== "none") this.el.querySelector("svg").innerHTML = CURSORS[kind];
      this.render();
    }

    render() {
      const k = this.kind === "none" ? "arrow" : this.kind;
      const [hx, hy] = HOT[k];
      this.el.style.transform = `translate(${this.x - hx}px, ${this.y - hy}px) scale(${this.buttons ? 0.9 : 1})`;
      this.el.style.opacity = this.hidden || this.kind === "none" ? 0 : 1;
    }

    ripple() {
      const r = document.createElement("div");
      r.className = "sr-ripple";
      r.style.left = this.x + "px";
      r.style.top = this.y + "px";
      this.stage.appendChild(r);
      setTimeout(() => r.remove(), 700);
    }

    showKey(label) {
      const k = document.createElement("kbd");
      k.textContent = label;
      this.hud.appendChild(k);
      while (this.hud.children.length > 8) this.hud.firstChild.remove();
      setTimeout(() => k.classList.add("out"), 900);
      setTimeout(() => k.remove(), 1300);
    }

    // --- Event synthesis ---------------------------------------------------------------------
    under() {
      const doc = this.doc;
      return (doc && doc.elementFromPoint(this.x, this.y)) || (doc && doc.documentElement);
    }

    target() { return this.capture && this.capture.isConnected ? this.capture : this.under(); }

    fire(type, el, extra = {}) {
      if (!el) return true;
      const W = this.win;
      const ptr = type.startsWith("pointer") || type.endsWith("pointercapture");
      const C = ptr ? W.PointerEvent : type === "wheel" ? W.WheelEvent : W.MouseEvent;
      const bubbles = !/enter|leave/.test(type);
      const ev = new C(type, {
        bubbles, cancelable: bubbles, composed: true, view: W,
        clientX: this.x, clientY: this.y, screenX: this.x, screenY: this.y,
        movementX: this.dx || 0, movementY: this.dy || 0,
        buttons: this.buttons, button: 0,
        pointerId: 1, pointerType: "mouse", isPrimary: true, pressure: this.buttons ? 0.5 : 0, width: 1, height: 1,
        ...extra,
      });
      return el.dispatchEvent(ev);
    }

    chain(el) {
      const out = [];
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) out.push(n);
      return out;
    }

    updateHover() {
      const el = this.under();
      const next = this.chain(el);
      const prev = this.hover.filter((n) => n.isConnected);
      if (prev[0] !== next[0]) {
        if (prev[0]) { this.fire("pointerout", prev[0]); this.fire("mouseout", prev[0]); }
        for (const n of prev) if (!next.includes(n)) { n.removeAttribute("sr-h"); this.fire("pointerleave", n); this.fire("mouseleave", n); }
        if (next[0]) { this.fire("pointerover", next[0]); this.fire("mouseover", next[0]); }
        for (const n of [...next].reverse()) if (!prev.includes(n)) { n.setAttribute("sr-h", ""); this.fire("pointerenter", n); this.fire("mouseenter", n); }
      }
      for (const n of next) if (!n.hasAttribute("sr-h")) n.setAttribute("sr-h", "");
      this.hover = next;
      if (el) {
        try { this.setKind(cursorKind(this.win.getComputedStyle(el).cursor)); } catch (e) {}
      }
    }

    moveTo(x, y) {
      this.dx = x - this.x;
      this.dy = y - this.y;
      this.x = x;
      this.y = y;
      if (!this.doc) return this.render();
      this.updateHover();
      const t = this.target();
      if (this.fire("pointermove", t, { button: -1 })) this.fire("mousemove", t);
      this.render();
    }

    down() {
      this.buttons = 1;
      const t = this.target();
      this.downEl = t;
      this.ripple();
      this.render();
      const ok = this.fire("pointerdown", t);
      if (ok && this.fire("mousedown", t)) {
        const f = t && t.closest && t.closest("button,a[href],input,select,textarea,[tabindex],[contenteditable]");
        if (f && f.focus) f.focus({ preventScroll: true });
        else if (this.doc.activeElement && this.doc.activeElement !== this.doc.body && !t.closest?.("label")) this.doc.activeElement.blur();
      }
      for (const n of this.chain(t)) n.setAttribute("sr-a", "");
    }

    up() {
      const t = this.target();
      this.buttons = 0;
      this.fire("pointerup", t);
      this.fire("mouseup", t);
      this.doc.querySelectorAll("[sr-a]").forEach((n) => n.removeAttribute("sr-a"));
      const cap = this.capture;
      this.capture = null;
      if (cap) cap.dispatchEvent(new this.win.PointerEvent("lostpointercapture", { pointerId: 1, bubbles: true }));
      // click goes to the nearest common ancestor of the press and release targets
      const over = this.under();
      let c = this.downEl;
      while (c && over && !c.contains(over)) c = c.parentElement;
      if (c) {
        this.clicks = performance.now() - (this.lastClick || -1e9) < 450 ? (this.clicks || 1) + 1 : 1;
        this.lastClick = performance.now();
        this.fire("click", c, { detail: this.clicks });
        if (this.clicks === 2) this.fire("dblclick", c, { detail: 2 });
      }
      this.render();
      this.updateHover();
    }

    wheel(dy, dx = 0) {
      const t = this.under();
      if (!this.fire("wheel", t, { deltaY: dy, deltaX: dx, deltaMode: 0 })) return;
      for (let n = t; n; n = n.parentElement) {
        if (n === this.doc.body || n === this.doc.documentElement) break;
        const s = this.win.getComputedStyle(n);
        const canY = dy && /auto|scroll/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1;
        const canX = dx && /auto|scroll/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1;
        if (canY || canX) return n.scrollBy({ top: dy, left: dx, behavior: "instant" });
      }
      this.win.scrollBy({ top: dy, left: dx, behavior: "instant" });
    }

    key(k, type = "both", mods = {}) {
      const doc = this.doc;
      const t = doc.activeElement || doc.body;
      const mk = (name) => {
        const ev = new this.win.KeyboardEvent(name, { key: k, code: code(k), bubbles: true, cancelable: true, composed: true, ...mods });
        const kc = keyCode(k);
        Object.defineProperty(ev, "keyCode", { get: () => kc });
        Object.defineProperty(ev, "which", { get: () => kc });
        return t.dispatchEvent(ev);
      };
      let ok = true;
      if (type !== "up") ok = mk("keydown");
      if (type !== "down") mk("keyup");
      // default actions the demos depend on
      if (ok && type !== "up") {
        if (k === "Tab") this.tabFocus(mods.shiftKey ? -1 : 1);
        else if ((k === "Enter" || k === " ") && t.matches && t.matches("button,[role=button],summary,a[href]") && !mods.noclick) t.click();
      }
      return ok;
    }

    tabFocus(dir) {
      const doc = this.doc;
      const all = [...doc.querySelectorAll("a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex='-1']),[contenteditable]")]
        .filter((n) => !n.disabled && n.getClientRects().length && !n.closest("[inert]") && this.win.getComputedStyle(n).visibility !== "hidden");
      const i = all.indexOf(doc.activeElement);
      const n = all[(i + dir + all.length) % all.length] || all[0];
      if (n) n.focus();
    }

    insertText(ch) {
      const doc = this.doc, el = doc.activeElement;
      if (!el) return;
      if (ch === "\n") {
        if (!this.key("Enter", "down", { noclick: true })) return this.key("Enter", "up");
        if (el.tagName === "TEXTAREA" || el.isContentEditable) doc.execCommand("insertLineBreak");
        else if (el.form) el.form.requestSubmit ? el.form.requestSubmit() : el.form.submit();
        this.key("Enter", "up");
        return;
      }
      if (ch === "\b") {
        if (this.key("Backspace", "down")) doc.execCommand("delete");
        this.key("Backspace", "up");
        return;
      }
      const ok = this.key(ch, "down");
      if (ok && !doc.execCommand("insertText", false, ch) && "value" in el) {
        el.value += ch;
        el.dispatchEvent(new this.win.InputEvent("input", { bubbles: true, data: ch, inputType: "insertText" }));
      }
      this.key(ch, "up");
    }

    // --- Target resolution -------------------------------------------------------------------
    // "@0.5,0.4" = fractions of the viewport; "sel" = centre of the first visible match;
    // "sel@0.2,0.5" = a point inside that element; [x, y] = pixels.
    find(sel) {
      const all = [...this.doc.querySelectorAll(sel)];
      return all.find((n) => { const r = n.getBoundingClientRect(); return r.width && r.height && r.bottom > 0 && r.top < this.win.innerHeight; }) || all[0];
    }

    point(t) {
      const W = this.win || window;
      if (Array.isArray(t)) return { x: t[0], y: t[1] };
      if (typeof t !== "string") return { x: this.x, y: this.y };
      if (t.startsWith("@")) { const [a, b] = t.slice(1).split(",").map(Number); return { x: a * W.innerWidth, y: b * W.innerHeight }; }
      if (t.startsWith("+")) { const [a, b] = t.slice(1).split(",").map(Number); return { x: this.x + a, y: this.y + b }; }
      let fx = 0.5, fy = 0.5, sel = t;
      const m = t.match(/^(.*)@(-?[\d.]+),(-?[\d.]+)$/);
      if (m) { sel = m[1]; fx = +m[2]; fy = +m[3]; }
      const el = this.find(sel);
      if (!el) { (window.__srWarnings ||= []).push("missing " + sel); return null; }
      const r = el.getBoundingClientRect();
      return { x: clamp(r.left + r.width * fx, 2, W.innerWidth - 2), y: clamp(r.top + r.height * fy, 2, W.innerHeight - 2) };
    }

    // --- Motion primitives -------------------------------------------------------------------
    async glide(t, ms, gen) {
      const p = this.point(t);
      if (!p) return;
      const x0 = this.x, y0 = this.y, dx = p.x - x0, dy = p.y - y0;
      const dist = Math.hypot(dx, dy);
      ms = ms == null ? clamp(300 + dist * 0.6, 350, 1000) : ms;
      // a slight arc so the path feels hand-made
      const bend = Math.min(dist * 0.12, 60) * (this.bendSign = -(this.bendSign || 1));
      const nx = dist ? -dy / dist : 0, ny = dist ? dx / dist : 0;
      const start = performance.now();
      for (;;) {
        await this.tick(gen);
        const raw = clamp((performance.now() - start) / Math.max(ms, 1), 0, 1);
        const e = easeInOut(raw), arc = Math.sin(raw * Math.PI) * bend;
        this.moveTo(x0 + dx * e + nx * arc, y0 + dy * e + ny * arc);
        if (raw >= 1) break;
      }
    }

    async path(kind, ms, o, gen) {
      const W = this.win;
      const w = W.innerWidth, h = W.innerHeight;
      const cx = (o.cx ?? 0.5) * w, cy = (o.cy ?? 0.5) * h;
      const r = (o.r ?? 0.28) * Math.min(w, h);
      const turns = o.turns ?? 1;
      const f = {
        circle: (t) => [cx + Math.cos(t * turns * 6.283 - 1.57) * r * 1.3, cy + Math.sin(t * turns * 6.283 - 1.57) * r],
        eight: (t) => [cx + Math.sin(t * turns * 6.283) * r * 1.6, cy + Math.sin(t * turns * 12.566) * r * 0.6],
        wander: (t) => [cx + (Math.sin(t * 6.1 * turns + 0.3) * 0.62 + Math.sin(t * 13.7 * turns) * 0.38) * r * 1.7, cy + (Math.sin(t * 4.3 * turns + 1.4) * 0.6 + Math.cos(t * 11.1 * turns) * 0.4) * r * 1.1],
        sweep: (t) => [w * (0.12 + 0.76 * easeInOut(t)), cy + Math.sin(t * 6.283 * turns) * r * 0.3],
        zigzag: (t) => { const k = t * (o.legs || 4), i = Math.floor(k), u = k - i; return [w * (0.15 + 0.7 * (i % 2 ? 1 - u : u)), h * (0.2 + 0.6 * (t))]; },
        spiral: (t) => [cx + Math.cos(t * turns * 6.283) * r * 1.3 * (1 - t * 0.85), cy + Math.sin(t * turns * 6.283) * r * (1 - t * 0.85)],
      }[kind];
      const [sx, sy] = f(0);
      await this.glide([sx, sy], o.lead ?? 400, gen);
      if (o.down) this.down();
      const start = performance.now();
      for (;;) {
        await this.tick(gen);
        const t = clamp((performance.now() - start) / ms, 0, 1);
        const [x, y] = f(t);
        this.moveTo(x, y);
        if (t >= 1) break;
      }
      if (o.down) this.up();
    }

    async scroll(to, ms, gen, sel) {
      const W = this.win, doc = this.doc;
      const box = sel ? this.find(sel) : null;
      const max = box ? box.scrollHeight - box.clientHeight : doc.scrollingElement.scrollHeight - W.innerHeight;
      const from = box ? box.scrollTop : W.scrollY;
      let y;
      if (typeof to === "number") y = to;
      else if (to === "end") y = max;
      else if (/%$/.test(to)) y = (parseFloat(to) / 100) * max;
      else if (/^[+-]\d/.test(to)) y = from + parseFloat(to);
      else { const el = this.find(to); y = el ? el.getBoundingClientRect().top + from - W.innerHeight * 0.15 : from; }
      y = clamp(y, 0, max);
      const start = performance.now();
      // the wheel is what visitors use, so show a gentle scroll-wheel pulse on the cursor
      this.el.classList.add("scrolling");
      try {
        for (;;) {
          await this.tick(gen);
          const t = clamp((performance.now() - start) / ms, 0, 1);
          const v = from + (y - from) * easeInOut(t);
          if (box) box.scrollTop = v; else W.scrollTo({ top: v, behavior: "instant" });
          // effects that react to pointer position under a moving page get a fresh move event
          if (Math.round(performance.now() / 16) % 6 === 0) this.moveTo(this.x, this.y);
          if (t >= 1) break;
        }
      } finally { this.el.classList.remove("scrolling"); }
    }

    // --- Scene runner ------------------------------------------------------------------------
    async run(actions, gen) {
      for (const a of actions) await this.step(a, gen);
    }

    async step(a, gen) {
      const [op, ...p] = a;
      switch (op) {
        case "wait": return this.sleep(p[0], gen);
        case "move": return this.glide(p[0], p[1], gen);
        case "hover": await this.glide(p[0], p[2], gen); return this.sleep(p[1] ?? 700, gen);
        case "click":
          if (p[0]) await this.glide(p[0], p[1], gen);
          this.down(); await this.sleep(90, gen); this.up();
          return this.sleep(p[2] ?? 260, gen);
        case "dbl":
          if (p[0]) await this.glide(p[0], p[1], gen);
          for (let i = 0; i < 2; i++) { this.down(); await this.sleep(60, gen); this.up(); await this.sleep(90, gen); }
          return this.sleep(250, gen);
        case "down": if (p[0]) await this.glide(p[0], p[1], gen); this.down(); return this.sleep(p[2] ?? 120, gen);
        case "up": this.up(); return this.sleep(p[0] ?? 120, gen);
        case "drag": {
          await this.glide(p[0], p[3], gen);
          this.down();
          await this.sleep(140, gen);
          await this.glide(p[1], p[2] ?? 900, gen);
          await this.sleep(p[4] ?? 120, gen);
          this.up();
          return this.sleep(200, gen);
        }
        case "path": return this.path(p[0], p[1], p[2] || {}, gen);
        case "scroll": return this.scroll(p[0], p[1] ?? 1800, gen, p[2]);
        case "wheel": {
          // p: total delta, duration, per-event delta, dx
          const total = p[0], ms = p[1] ?? 1200, per = p[2] ?? 40, n = Math.max(1, Math.round(Math.abs(total) / per));
          for (let i = 0; i < n; i++) {
            this.wheel(p[3] ? 0 : Math.sign(total) * per, p[3] ? Math.sign(total) * per : 0);
            await this.sleep(ms / n, gen);
          }
          return;
        }
        case "key": {
          const keys = Array.isArray(p[0]) ? p[0] : [p[0]];
          for (const k of keys) {
            this.showKey(LABELS[k] || k);
            this.key(k, "both", p[2] || {});
            await this.sleep(p[1] ?? 260, gen);
          }
          return;
        }
        case "hold": {
          // hold a key down for a while: [hold, key, ms]
          this.showKey(LABELS[p[0]] || p[0]);
          this.key(p[0], "down");
          await this.sleep(p[1], gen);
          this.key(p[0], "up");
          return;
        }
        case "type": {
          if (p[0]) { await this.glide(p[0], null, gen); this.down(); await this.sleep(60, gen); this.up(); }
          const el = p[0] && this.find(p[0].replace(/@[-\d.]+,[-\d.]+$/, ""));
          if (el && el.focus && this.doc.activeElement !== el) el.focus();
          if (p[3]) { if ("value" in el) el.value = ""; }
          for (const ch of p[1]) {
            this.insertText(ch);
            if (ch === "\n") this.showKey("⏎");
            await this.sleep(p[2] ?? 70, gen);
          }
          return this.sleep(200, gen);
        }
        case "set": {
          // animate a range/number input to a value, dragging its thumb
          const el = this.find(p[0]);
          if (!el) return;
          const min = +el.min || 0, max = el.max === "" ? 100 : +el.max, from = +el.value, to = p[1], ms = p[2] ?? 1200;
          const r = el.getBoundingClientRect();
          const at = (v) => [r.left + 8 + ((v - min) / (max - min || 1)) * (r.width - 16), r.top + r.height / 2];
          await this.glide(at(from), null, gen);
          this.down();
          const start = performance.now();
          for (;;) {
            await this.tick(gen);
            const t = clamp((performance.now() - start) / ms, 0, 1);
            const v = from + (to - from) * easeInOut(t);
            el.value = v;
            this.moveTo(...at(+el.value));
            el.dispatchEvent(new this.win.Event("input", { bubbles: true }));
            if (t >= 1) break;
          }
          el.dispatchEvent(new this.win.Event("change", { bubbles: true }));
          this.up();
          return this.sleep(200, gen);
        }
        case "select": {
          const el = this.find(p[0]);
          if (!el) return;
          await this.glide(p[0], null, gen);
          this.down(); await this.sleep(80, gen); this.up();
          await this.sleep(300, gen);
          el.value = p[1];
          el.dispatchEvent(new this.win.Event("input", { bubbles: true }));
          el.dispatchEvent(new this.win.Event("change", { bubbles: true }));
          return this.sleep(300, gen);
        }
        case "focus": { const el = this.find(p[0]); if (el) el.focus(); return; }
        case "js": { new this.win.Function(p[0]).call(this.win); return; }
        case "cursor": this.hidden = p[0] === "hide"; this.render(); return;
        case "mark": return;
        case "jump": { const pt = this.point(p[0]); if (pt) this.moveTo(pt.x, pt.y); return; }
        default: console.warn("showreel: unknown action", op);
      }
    }
  }

  window.ShowreelDriver = Driver;
  window.ShowreelSkip = Skip;
})();
