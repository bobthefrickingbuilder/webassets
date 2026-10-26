/* GPU stable-fluids solver (Jos Stam style): advection, vorticity confinement and Jacobi pressure projection.
   Requires gl.js. Usage:
     const sim = FluidSim.create(canvas, { simRes: 128, dyeRes: 768 });
     sim.splat(x, y, dx, dy, [r, g, b]);   // x, y in 0..1 (y up); dx, dy = force
     sim.step(dt); sim.render();
   Tweak sim.params (curl, pressureIterations, velocityDissipation, dyeDissipation, splatRadius) at runtime. */
(function () {
  const SHADERS = {
    splat: `uniform sampler2D u_target; uniform float u_aspect; uniform vec3 u_color; uniform vec2 u_point; uniform float u_radius;
      void main(){ vec2 p = v_uv - u_point; p.x *= u_aspect; vec3 s = exp(-dot(p, p) / u_radius) * u_color; o = vec4(texture(u_target, v_uv).xyz + s, 1.); }`,
    advect: `uniform sampler2D u_velocity; uniform sampler2D u_source; uniform vec2 u_texel; uniform float u_dt; uniform float u_dissipation;
      void main(){ vec2 coord = v_uv - u_dt * texture(u_velocity, v_uv).xy * u_texel; o = texture(u_source, coord) / (1. + u_dissipation * u_dt); }`,
    divergence: `uniform sampler2D u_velocity; uniform vec2 u_texel;
      void main(){
        float L = texture(u_velocity, v_uv - vec2(u_texel.x, 0)).x, R = texture(u_velocity, v_uv + vec2(u_texel.x, 0)).x;
        float B = texture(u_velocity, v_uv - vec2(0, u_texel.y)).y, T = texture(u_velocity, v_uv + vec2(0, u_texel.y)).y;
        o = vec4(.5 * (R - L + T - B), 0, 0, 1); }`,
    curl: `uniform sampler2D u_velocity; uniform vec2 u_texel;
      void main(){
        float L = texture(u_velocity, v_uv - vec2(u_texel.x, 0)).y, R = texture(u_velocity, v_uv + vec2(u_texel.x, 0)).y;
        float B = texture(u_velocity, v_uv - vec2(0, u_texel.y)).x, T = texture(u_velocity, v_uv + vec2(0, u_texel.y)).x;
        o = vec4(.5 * (R - L - T + B), 0, 0, 1); }`,
    vorticity: `uniform sampler2D u_velocity; uniform sampler2D u_curl; uniform vec2 u_texel; uniform float u_strength; uniform float u_dt;
      void main(){
        float L = texture(u_curl, v_uv - vec2(u_texel.x, 0)).x, R = texture(u_curl, v_uv + vec2(u_texel.x, 0)).x;
        float B = texture(u_curl, v_uv - vec2(0, u_texel.y)).x, T = texture(u_curl, v_uv + vec2(0, u_texel.y)).x;
        float C = texture(u_curl, v_uv).x;
        vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        f = f / (length(f) + 1e-4) * u_strength * C; f.y *= -1.;
        vec2 v = texture(u_velocity, v_uv).xy + f * u_dt;
        o = vec4(clamp(v, -1000., 1000.), 0, 1); }`,
    pressure: `uniform sampler2D u_pressure; uniform sampler2D u_divergence; uniform vec2 u_texel;
      void main(){
        float L = texture(u_pressure, v_uv - vec2(u_texel.x, 0)).x, R = texture(u_pressure, v_uv + vec2(u_texel.x, 0)).x;
        float B = texture(u_pressure, v_uv - vec2(0, u_texel.y)).x, T = texture(u_pressure, v_uv + vec2(0, u_texel.y)).x;
        o = vec4((L + R + B + T - texture(u_divergence, v_uv).x) * .25, 0, 0, 1); }`,
    gradient: `uniform sampler2D u_pressure; uniform sampler2D u_velocity; uniform vec2 u_texel;
      void main(){
        float L = texture(u_pressure, v_uv - vec2(u_texel.x, 0)).x, R = texture(u_pressure, v_uv + vec2(u_texel.x, 0)).x;
        float B = texture(u_pressure, v_uv - vec2(0, u_texel.y)).x, T = texture(u_pressure, v_uv + vec2(0, u_texel.y)).x;
        o = vec4(texture(u_velocity, v_uv).xy - vec2(R - L, T - B), 0, 1); }`,
    scale: `uniform sampler2D u_tex; uniform float u_value; void main(){ o = u_value * texture(u_tex, v_uv); }`,
    copy: `uniform sampler2D u_tex; void main(){ o = texture(u_tex, v_uv); }`,
    display: `uniform sampler2D u_tex; uniform float u_gamma;
      void main(){ vec3 c = texture(u_tex, v_uv).rgb; o = vec4(pow(max(c, 0.), vec3(u_gamma)), 1.); }`,
  };

  function create(canvas, opts) {
    opts = opts || {};
    const gl = GL.context(canvas, { alpha: false });
    if (!gl) return null;
    const P = {};
    for (const k in SHADERS) P[k] = GL.program(gl, SHADERS[k]);
    const params = Object.assign({ curl: 28, pressureIterations: 20, velocityDissipation: 0.2, dyeDissipation: 0.9, splatRadius: 0.0025, gamma: 0.85 }, opts.params);
    const simRes = opts.simRes || 128, dyeRes = opts.dyeRes || 768;
    let vel, dye, pressure, divT, curlT, texel;

    function res(r) {
      const a = canvas.width / canvas.height, big = Math.round(r * Math.max(a, 1 / a));
      return a > 1 ? [big, r] : [r, big];
    }
    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, opts.dpr || 1.5);
      canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
      const [sw, sh] = res(simRes), [dw, dh] = res(dyeRes), f = { float: true };
      vel = GL.doubleTarget(gl, sw, sh, f); dye = GL.doubleTarget(gl, dw, dh, f); pressure = GL.doubleTarget(gl, sw, sh, f);
      divT = GL.target(gl, sw, sh, f); curlT = GL.target(gl, sw, sh, f);
      texel = [1 / sw, 1 / sh];
    }
    resize();

    function splat(x, y, dx, dy, color, radius) {
      const aspect = canvas.width / canvas.height, r = radius || params.splatRadius;
      P.splat.use().set("u_target", vel.read).set("u_aspect", aspect).set("u_point", [x, y]).set("u_color", [dx, dy, 0]).set("u_radius", r);
      GL.draw(gl, vel.write); vel.swap();
      P.splat.use().set("u_target", dye.read).set("u_aspect", aspect).set("u_point", [x, y]).set("u_color", color).set("u_radius", r);
      GL.draw(gl, dye.write); dye.swap();
    }
    function step(dt) {
      P.curl.use().set("u_velocity", vel.read).set("u_texel", texel); GL.draw(gl, curlT);
      P.vorticity.use().set("u_velocity", vel.read).set("u_curl", curlT).set("u_texel", texel).set("u_strength", params.curl).set("u_dt", dt); GL.draw(gl, vel.write); vel.swap();
      P.divergence.use().set("u_velocity", vel.read).set("u_texel", texel); GL.draw(gl, divT);
      P.scale.use().set("u_tex", pressure.read).set("u_value", 0.8); GL.draw(gl, pressure.write); pressure.swap();
      for (let i = 0; i < params.pressureIterations; i++) { P.pressure.use().set("u_pressure", pressure.read).set("u_divergence", divT).set("u_texel", texel); GL.draw(gl, pressure.write); pressure.swap(); }
      P.gradient.use().set("u_pressure", pressure.read).set("u_velocity", vel.read).set("u_texel", texel); GL.draw(gl, vel.write); vel.swap();
      P.advect.use().set("u_velocity", vel.read).set("u_source", vel.read).set("u_texel", texel).set("u_dt", dt).set("u_dissipation", params.velocityDissipation); GL.draw(gl, vel.write); vel.swap();
      P.advect.use().set("u_velocity", vel.read).set("u_source", dye.read).set("u_texel", texel).set("u_dt", dt).set("u_dissipation", params.dyeDissipation); GL.draw(gl, dye.write); dye.swap();
    }
    function render() { P.display.use().set("u_tex", dye.read).set("u_gamma", params.gamma); GL.draw(gl, null); }
    // Replace the dye with an image (e.g. to stir a picture around).
    function setDye(source) {
      const t = GL.texture(gl, 0, 0, { source });
      P.copy.use().set("u_tex", t); GL.draw(gl, dye.write); dye.swap();
      gl.deleteTexture(t);
    }
    function clear() {
      for (const d of [vel, dye, pressure]) for (const tgt of [d.read, d.write]) { gl.bindFramebuffer(gl.FRAMEBUFFER, tgt.fbo); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    }
    return { gl, params, splat, step, render, resize, setDye, clear };
  }

  // HSV → RGB helper for colourful splats; v scales brightness.
  function hsv(h, s, v) {
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
  }

  window.FluidSim = { create, hsv };
})();
