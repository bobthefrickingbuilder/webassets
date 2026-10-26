/* Minimal WebGL2 helper for the shader demos.
   GL.fullscreen(canvas, fragSource, opts) runs a full-screen fragment shader with
   u_time, u_res, u_mouse (xy = pointer px, z = down, y-up) and any extra uniforms.
   Lower-level helpers (program, target, doubleTarget, draw) power the multi-pass sims. */
(function () {
  const VERT = "#version 300 es\nin vec2 p;out vec2 v_uv;void main(){v_uv=p*.5+.5;gl_Position=vec4(p,0,1);}";
  const HEADER = "#version 300 es\nprecision highp float;\nin vec2 v_uv;\nout vec4 o;\n";

  function context(canvas, attrs) {
    const gl = canvas.getContext("webgl2", Object.assign({ antialias: false, premultipliedAlpha: false }, attrs));
    if (!gl) {
      fallback(canvas, "WebGL2 is not available in this browser.");
      return null;
    }
    gl.getExtension("EXT_color_buffer_float");
    gl.getExtension("OES_texture_float_linear");
    // One big triangle covers the screen.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    return gl;
  }

  function fallback(canvas, msg) {
    const d = document.createElement("div");
    d.textContent = msg;
    d.style.cssText = "position:fixed;inset:0;display:grid;place-items:center;color:#8a90a2;font:15px system-ui";
    canvas.replaceWith(d);
  }

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      console.error(log + "\n" + src.split("\n").map((l, i) => i + 1 + ": " + l).join("\n"));
      throw new Error("Shader compile failed: " + log);
    }
    return s;
  }

  function program(gl, frag, vert) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vert || VERT));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag.startsWith("#version") ? frag : HEADER + frag));
    gl.bindAttribLocation(p, 0, "p");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const info = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const u = gl.getActiveUniform(p, i);
      info[u.name.replace(/\[0\]$/, "")] = { loc: gl.getUniformLocation(p, u.name), type: u.type, size: u.size };
    }
    let unit = 0;
    return {
      p,
      use() { gl.useProgram(p); unit = 0; return this; },
      // Sets a uniform by inspecting its declared type. Textures accept a WebGLTexture.
      set(name, v) {
        const u = info[name];
        if (!u) return this;
        const L = u.loc;
        switch (u.type) {
          case gl.FLOAT: u.size > 1 ? gl.uniform1fv(L, v) : gl.uniform1f(L, v); break;
          case gl.FLOAT_VEC2: gl.uniform2fv(L, v); break;
          case gl.FLOAT_VEC3: gl.uniform3fv(L, v); break;
          case gl.FLOAT_VEC4: gl.uniform4fv(L, v); break;
          case gl.INT: case gl.BOOL: gl.uniform1i(L, v); break;
          case gl.SAMPLER_2D:
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, v && v.tex ? v.tex : v);
            gl.uniform1i(L, unit++);
            break;
        }
        return this;
      },
    };
  }

  function texture(gl, w, h, opts) {
    opts = opts || {};
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    const filter = opts.nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    const wrap = opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    if (opts.source) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, opts.source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    } else if (opts.float) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, opts.data || null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, opts.data || null);
    }
    return t;
  }

  function target(gl, w, h, opts) {
    const tex = texture(gl, w, h, opts);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, w, h };
  }

  function doubleTarget(gl, w, h, opts) {
    const d = { read: target(gl, w, h, opts), write: target(gl, w, h, opts), w, h };
    d.swap = function () { const t = d.read; d.read = d.write; d.write = t; };
    return d;
  }

  // Draws a full-screen pass into `dest` (a target) or the canvas when dest is null.
  function draw(gl, dest) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dest ? dest.fbo : null);
    gl.viewport(0, 0, dest ? dest.w : gl.drawingBufferWidth, dest ? dest.h : gl.drawingBufferHeight);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Tracks pointer position (canvas pixels, y-up) and button state.
  function pointer(canvas, dprRef) {
    const m = { x: 0, y: 0, down: 0, px: 0, py: 0, moved: false };
    function upd(e) {
      const r = canvas.getBoundingClientRect();
      const dpr = dprRef();
      m.px = m.x; m.py = m.y;
      m.x = (e.clientX - r.left) * dpr;
      m.y = (r.height - (e.clientY - r.top)) * dpr;
      m.moved = true;
    }
    addEventListener("pointermove", upd);
    canvas.addEventListener("pointerdown", (e) => { upd(e); m.down = 1; });
    addEventListener("pointerup", () => { m.down = 0; });
    return m;
  }

  function fullscreen(canvas, frag, opts) {
    opts = opts || {};
    const gl = context(canvas, opts.attrs);
    if (!gl) return null;
    const prog = program(gl, frag);
    const maxDpr = opts.dpr || 1.5;
    let dpr = Math.min(devicePixelRatio || 1, maxDpr);
    const m = pointer(canvas, () => dpr);
    m.x = canvas.clientWidth * dpr * 0.5; m.y = canvas.clientHeight * dpr * 0.5;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frozen = opts.freezeAt || 2.0;

    function resize() {
      dpr = Math.min(devicePixelRatio || 1, maxDpr);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }

    const state = { gl, prog, mouse: m, uniforms: opts.uniforms || {} };
    function frame(now) {
      resize();
      const t = reduced ? frozen : (now - start) / 1000;
      prog.use()
        .set("u_time", t)
        .set("u_res", [canvas.width, canvas.height])
        .set("u_mouse", [m.x, m.y, m.down, 0]);
      const extra = typeof state.uniforms === "function" ? state.uniforms(t) : state.uniforms;
      for (const k in extra) prog.set(k, extra[k]);
      draw(gl, null);
      if (!reduced) requestAnimationFrame(frame);
    }
    if (reduced) {
      // Static frame, re-rendered on interaction so pointer-driven shaders still respond.
      addEventListener("pointermove", () => requestAnimationFrame(frame));
      addEventListener("resize", () => requestAnimationFrame(frame));
    }
    requestAnimationFrame(frame);
    return state;
  }

  window.GL = { context, program, texture, target, doubleTarget, draw, pointer, fullscreen, fallback };
})();
