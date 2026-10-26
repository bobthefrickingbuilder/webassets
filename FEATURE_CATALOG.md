# Web Assets: Proposed Feature Catalog

The full list of animations and features I propose to build in this repo. Nothing has been coded yet. Pick what you want built (or say "all") and I'll start.

**Legend:** tech used (CSS / JS / Canvas / SVG / WebGL / WebGPU). Complexity: ● simple · ●● medium · ●●● advanced.

**Proposed structure:** each effect lives in its own folder (`effects/<category>/<name>/`) with a standalone `index.html` demo, its own CSS/JS, and a short README covering usage and options. A root `index.html` gallery shows them all with search and category filters. The default is vanilla HTML/CSS/JS with no build step, so every effect can be copied into any site. Every effect respects `prefers-reduced-motion`.

---

## 1. Scroll animations (26)

1. Fade/slide/scale reveal on scroll, with stagger groups (CSS `animation-timeline: view()` + IntersectionObserver fallback) ●
2. Scroll progress bar, at the page top or around a circle (CSS `scroll-timeline`) ●
3. Multi-layer parallax hero with depth layers (CSS) ●
4. Sticky "pinned" section where content swaps while pinned (CSS sticky + JS) ●●
5. Horizontal scroll section driven by vertical scroll ●●
6. Scroll-scrubbed image sequence, Apple-product-page style (Canvas) ●●●
7. Text that fills or highlights word by word as you scroll ●●
8. Clip-path reveal: an image expands from a small window to full screen on scroll ●●
9. Smooth/inertia scrolling, Lenis-style (JS) ●●
10. Scroll-velocity skew: content leans with scroll speed ●●
11. Infinite marquee whose speed and direction react to scroll ●●
12. Zoom-through-text: scroll "flies through" a giant word into the next section ●●●
13. Stacking cards that pile up as you scroll ●●
14. Scroll-snapped full-page sections with animated transitions ●●
15. SVG path that draws itself along the scroll (line-drawing timeline) ●●
16. Number counters that tick up when visible ●
17. Scroll-linked 3D rotation of an object (CSS 3D) ●●
18. Split-screen scroll: the left side scrolls up while the right scrolls down ●●
19. Background color and theme morphing between sections ●
20. Scroll-triggered animations, the new CSS trigger syntax with a fallback ●●
21. Image grid that spreads apart or assembles on scroll ●●
22. Curved / circular text that rotates with scroll ●
23. Timeline component with a progress line and milestone reveals ●●
24. "Scrollytelling" chapter layout with sticky graphics and stepping text ●●●
25. Back-to-top button with a scroll-progress ring ●
26. Reading-time remaining indicator ●

## 2. Text and typography effects (28)

27. Text scramble / decode, hacker-style character shuffle ●
28. Typewriter with cursor, multiple phrases, and delete/retype ●
29. Split-text stagger: letters fly in from random positions ●●
30. Variable-font "breathing" weight/width wave ●●
31. Variable-font weight that responds to cursor proximity ●●
32. Gradient text with an animated moving gradient (`@property`) ●
33. Shimmer / shine sweep across text ●
34. Glitch text with RGB split and slice jitter (CSS) ●
35. Neon flicker sign text ●
36. Liquid / gooey text morph between words (SVG filter) ●●
37. Text morphing between words with blur crossfade ●●
38. 3D extruded text with a layered shadow stack that tilts with the mouse ●●
39. Rotating word carousel ("We build *websites / apps / brands*") ●
40. Wavy text: letters bob in a sine wave ●
41. Text mask reveal: video or image visible through the letters ●
42. Outline-to-fill text on hover ●
43. Letter-by-letter hover bounce (rubber band) ●
44. Kinetic typography poster, looping animated type composition ●●●
45. Text along an animated SVG path ●●
46. Split-flap airport display (Solari board) ●●
47. Matrix digital rain behind or within text (Canvas) ●●
48. Handwriting / signature draw-on (SVG stroke) ●●
49. Blur-in word reveal (Apple keynote style) ●
50. Magnetic letters that repel from the cursor ●●
51. Text explode into particles on click (Canvas) ●●●
52. Odometer number roll ●●
53. ASCII-art text banner generator ●●
54. Text that's "lit" by a cursor spotlight ●

## 3. Cursor and pointer effects (18)

55. Custom smooth-follow cursor (dot + lagging ring) ●
56. Cursor that morphs into labels ("View", "Drag", "Play") over elements ●●
57. Magnetic buttons that pull toward the cursor and spring back ●
58. Cursor trail: fading particles, sparkles, or a ribbon ●●
59. Spotlight / flashlight cursor that reveals a hidden layer ●
60. Blend-mode inverting cursor (`mix-blend-mode: difference`) ●
61. Fluid-simulation cursor trail (WebGL Navier–Stokes) ●●●
62. Image trail: images spawn and fade along the cursor path ●●
63. Elastic / gooey blob cursor that stretches with velocity ●●
64. Cursor-reactive dot grid: dots push away or scale near the pointer ●●
65. Tilt-on-hover 3D cards with glare ●
66. Ripple on click (Material-style and water-style) ●
67. Click "confetti / fireworks" burst ●●
68. Cursor-reactive gradient glow card borders ●
69. Rope/string physics cursor (verlet chain) ●●
70. "Googly eyes" that follow the cursor ●
71. Pixel-trail cursor (retro grid lights up) ●
72. Distortion lens cursor: magnifies or warps content under the pointer (WebGL) ●●●

## 4. Buttons and micro-interactions (22)

73. Liquid fill hover button ●
74. Animated gradient border button, rotating conic ●
75. Shiny/glossy sweep button ●
76. Button with a loading → success → error state morph ●●
77. Particle-burst "like" heart (Twitter style) ●●
78. Hamburger → X morph icons (10 variants) ●
79. Toggle switches: day/night, liquid, and 3D ●●
80. Animated checkbox and radio (draw-on checkmarks) ●
81. Elastic/jelly button press ●
82. Copy-to-clipboard button with a morphing icon and toast ●
83. Hold-to-confirm button with a progress fill ●●
84. Slide-to-unlock / swipe-to-confirm ●●
85. Animated star rating ●
86. Animated tabs with a sliding indicator (FLIP) ●●
87. Segmented control with a gooey indicator ●●
88. Floating labels and animated input focus effects (12 variants) ●
89. Password strength meter with animated feedback ●
90. Animated download button (progress → done) ●●
91. Animated icon set: play/pause, menu, search ↔ close (SVG morph) ●●
92. Pull-to-refresh with a custom animation ●●
93. Animated tooltip and popover using CSS anchor positioning ●●
94. Notification bell shake + badge count bump ●

## 5. Backgrounds and hero sections (26)

95. Animated mesh gradient (Stripe-style, WebGL) ●●●
96. Aurora / northern-lights background ●●
97. Floating blurred blobs (CSS) ●
98. Particle network / constellation, with lines connecting near points (Canvas) ●●
99. Perlin-noise flow field (Canvas) ●●
100. Starfield warp-speed tunnel ●●
101. Animated grid with a perspective "synthwave" floor ●●
102. Wave lines / animated SVG waves ●
103. Metaballs / lava lamp (WebGL) ●●●
104. Boids flocking simulation ●●●
105. Reaction-diffusion pattern (WebGL/WebGPU) ●●●
106. Animated noise / film grain overlay ●
107. Gradient that follows the cursor ●
108. Topographic contour lines, animated (marching squares) ●●●
109. Falling snow / rain / leaves / confetti weather ●●
110. Animated dot-matrix world map with pulsing points ●●
111. Spinning 3D globe with arcs (WebGL) ●●●
112. Bokeh light orbs ●
113. Voronoi cells animated ●●●
114. Retro CRT screen with scanlines and curvature ●●
115. Animated beams / spotlight sweeps ●
116. Morphing blob shape (SVG path interpolation) ●●
117. Ripple water surface that reacts to clicks (WebGL) ●●●
118. Lightning / electric arcs (Canvas) ●●
119. Fireflies ●
120. Galaxy spiral particles (WebGL) ●●●

## 6. Cards, images and galleries (20)

121. 3D flip cards ●
122. Image hover distortion / displacement transition (WebGL) ●●●
123. RGB-split image hover ●●
124. Before/after comparison slider ●
125. Expanding accordion gallery (flex panels) ●
126. Masonry grid with FLIP filtering animation ●●
127. Infinite draggable canvas gallery, pan in any direction with inertia ●●●
128. 3D carousel / cylinder gallery ●●
129. Coverflow slider ●●
130. Lightbox with a shared-element zoom (View Transitions API) ●●
131. Ken Burns slideshow ●
132. Pixelate / dissolve image transition ●●
133. Bento grid with hover reveals ●
134. Stack-of-cards swipe (Tinder-style) with physics ●●
135. Polaroid scatter that you can drag around ●●
136. Image reveal with "curtain" block wipes ●
137. Hover-reveal floating image list (portfolio style) ●●
138. Cloth / flag wave image effect (WebGL) ●●●
139. Glass morphism cards ●
140. Holographic / foil trading card (Pokémon-card shine) ●●

## 7. Page transitions and navigation (16)

141. Cross-document View Transitions between pages (native, zero JS) ●●
142. SPA-style page transitions: wipe, curtain, slide, zoom ●●
143. Shared-element morph between list and detail pages ●●
144. Full-screen overlay menu with staggered links ●
145. Circular reveal menu expanding from the button ●●
146. Perspective "page tilts back" menu ●●
147. Gooey / liquid nav indicator ●●
148. macOS-style magnifying dock ●●
149. Mega-menu with animated panels ●●
150. Command palette (⌘K) with fuzzy search and animations ●●
151. Animated breadcrumb and step progress ●
152. Radial / pie menu ●●
153. Sticky header that hides on scroll down and shows on scroll up ●
154. Preloader / intro sequences (counter, logo reveal, curtain) ●●
155. Animated tab bar (mobile) with a morphing bubble ●●
156. Theme switcher with a circular View-Transition wipe (dark/light) ●●

## 8. Loaders and progress (12)

157. A pack of 30 pure-CSS spinners and loaders ●
158. Skeleton shimmer placeholders ●
159. SVG morphing loader ●●
160. Bouncing-ball physics loader ●
161. DNA helix loader ●
162. Liquid fill percentage loader ●●
163. Pac-Man / retro game loader ●
164. Progress ring with a gradient stroke ●
165. Glitchy terminal boot sequence ●●
166. Hourglass with falling sand particles ●●
167. Infinity / Möbius path loader ●
168. Typing dots / chat indicator ●

## 9. SVG, CSS and filter magic (16)

169. Liquid Glass refraction panels, Apple-style (SVG displacement + backdrop-filter) ●●●
170. Gooey merge effect (blur + contrast filter) ●
171. Heat-haze / water distortion over content (feTurbulence) ●●
172. Animated SVG line-art illustrations ●●
173. CSS-only 3D objects: cube, prism, room scene ●●
174. Houdini paint worklets: squiggly borders, generative patterns ●●●
175. `@property`-animated conic gradients (pie charts, timers, borders) ●
176. Duotone / gradient-map image filters ●
177. Clip-path shape morphing ●
178. Animated SVG gradients and patterns ●
179. Paper fold / origami effect ●●
180. Fracture / shatter element into pieces ●●●
181. Ink bleed / watercolor reveal ●●
182. Inverted rounded corners with CSS masks ●
183. Scroll-driven SVG morphing ●●
184. Halftone dot effect on images (CSS/SVG) ●●

## 10. WebGL / WebGPU / 3D (18)

185. Three.js interactive 3D hero with an orbiting model ●●●
186. GPGPU particle morph between shapes (logo → sphere → text) ●●●
187. Post-processing shader pack: ASCII, dithering, halftone, CRT, pixel sort, chromatic aberration ●●●
188. Fluid simulation (WebGL) ●●●
189. WebGPU compute particles, 100k+ particles ●●●
190. Raymarched SDF blob / abstract scene ●●●
191. Shader-based image transitions (dozens of GL transitions) ●●●
192. Volumetric clouds / smoke ●●●
193. Interactive 3D product viewer (rotate, zoom, hotspots) ●●●
194. Infinite tunnel ●●
195. Terrain fly-over with generated landscape ●●●
196. Glass / transmission material spheres ●●●
197. Audio-reactive 3D visualizer ●●●
198. 3D text with physics (Cannon/Rapier) ●●●
199. Portal / "window into another world" effect ●●●
200. Point-cloud image: a photo becomes 3D particles ●●●
201. Water caustics ●●●
202. Webcam ASCII mirror (live camera → ASCII shader) ●●●

## 11. Physics and playful interactions (14)

203. Draggable physics playground: drop UI elements and they fall and stack (Matter.js-style) ●●●
204. Spring-based draggable elements with throw inertia ●●
205. Jelly / soft-body blobs ●●●
206. Cloth simulation you can tear ●●●
207. Bouncing DVD logo (corner hit celebration) ●
208. Ball pit of tags / skills ●●
209. Pendulum wave ●●
210. Gravity toggle: the page "falls apart" Easter egg ●●●
211. Rope bridge / chain physics ●●
212. Pinball / plinko ●●●
213. Sand falling simulation (cellular automata) ●●●
214. Fireworks show ●●
215. Bubble pop field ●
216. Magnet / repel field of particles ●●

## 12. Exotic and experimental (20)

217. Konami-code Easter-egg framework (pluggable surprises) ●
218. Audio-reactive page: elements pulse to mic or music (Web Audio) ●●
219. Device-tilt parallax on mobile (DeviceOrientation) ●●
220. Generative ambient sound on hover (Web Audio synth tones) ●●
221. Haptic feedback buttons (Vibration API) ●
222. Gamepad-controlled navigation ●●
223. Speech-controlled scroll / navigation (Web Speech API) ●●
224. Webcam hand-wave or motion detection to trigger animations ●●●
225. Multiplayer cursors demo (BroadcastChannel across tabs) ●●
226. Conway's Game of Life background you can draw on ●●
227. Mandelbrot / Julia fractal explorer (WebGL) ●●●
228. Time-of-day adaptive theme (sky gradients follow the real sun position) ●●
229. Battery / network-aware animation degrade ●
230. "Hacker terminal" interactive CLI portfolio ●●
231. Retro OS desktop UI (windows, drag, start menu) ●●●
232. Snake / Breakout mini-games embedded as 404 pages ●●
233. Scratch-off reveal card ●
234. Shake-to-undo / shake-for-surprise (accelerometer) ●●
235. Text-to-shape particle generator: type anything and particles form it ●●●
236. Pixel-art paint / draw canvas with animated playback ●●

## 13. Practical UI components, animated (14)

237. Modal / dialog with spring entrance (native `<dialog>`) ●
238. Toast notification system (stacking, swipe-to-dismiss) ●●
239. Accordion with smooth height (`interpolate-size`) ●
240. Animated pricing table with a monthly/yearly toggle ●●
241. Testimonial carousel with auto-play and drag ●●
242. Animated stats dashboard (charts drawing in) ●●
243. Countdown timer with flip digits ●●
244. Animated FAQ section ●
245. Cookie consent banner with a playful animation ●
246. Drag-and-drop sortable list with FLIP ●●
247. Multi-step form wizard with transitions ●●
248. Animated empty states and 404 illustrations ●●
249. Image cropper / zoom pan ●●
250. Kanban board with animated drag ●●●

---

## Totals

**250 effects across 13 categories.** The plain CSS ones are quick. The ●●● ones are each a mini-project.

## Decisions needed from you before I start

1. **Scope:** build all 250, or a subset (for example the top 50, or specific categories)?
2. **Tech:** vanilla HTML/CSS/JS with no build step (recommended, copy-paste anywhere), or React/TypeScript components?
3. **Libraries:** OK to use Three.js and GSAP (free, MIT/no-charge) for the advanced items, or keep it 100% dependency-free?
4. **Order:** I'd suggest a gallery site first, then categories 1–4 → 5–9 → 10–13.

## Research sources

- Interop 2026 (scroll-driven animations, view transitions): https://web.dev/blog/interop-2026
- Chrome scroll-triggered animations: https://developer.chrome.com/blog/scroll-triggered-animations
- CSS feature support levels: https://modern-css.com/reference/interop-2026/
- Codrops ASCII & dithering shaders (Efecto): https://tympanus.net/codrops/2026/01/04/efecto-building-real-time-ascii-and-dithering-effects-with-webgl-shaders
- Basement Shader Lab effect catalog: https://eng.basement.studio/tools/shader-lab/about
- Codrops WebGPU reaction-diffusion: https://tympanus.net/codrops/2024/05/01/reaction-diffusion-compute-shader-in-webgpu/
- WebGPU particle simulations: https://80.lv/articles/fascinating-particle-simulation-created-with-webgpu
- Awwwards shader inspiration: https://www.awwwards.com/inspiration/shader-effect
- 2026 award-winning sites roundup: https://www.hontran.dev/blog/best-award-winning-websites-2026
- School of Motion, animated sites 2026: https://www.schoolofmotion.com/blog/websites-with-great-animation-2026
- Figma web design trends: https://www.figma.com/resource-library/web-design-trends/
- React Bits / Aceternity / Magic UI comparison: https://www.pkgpulse.com/guides/react-bits-vs-aceternity-magic-ui-2026
- Liquid Glass in CSS + SVG: https://blog.logrocket.com/how-create-liquid-glass-effects-css-and-svg/
- SVG text distortion: https://fw21.henry.codes/writing/how-to-distort-text-with-svg
- Animated gradient borders with @property: https://dev.to/ibelick/creating-an-animated-gradient-border-with-css-33ni
- Houdini paint worklet example: https://github.com/over-engineer/inverted-corners
- Free GSAP plugin demos: https://tympanus.net/codrops/?p=93244
- Kinetic typography guide: https://studiomeyer.io/en/blog/kinetische-typografie
- Infinite canvas / nav inspiration: https://www.awwwards.com/inspiration/infinite-canvas-gallery-navigation-cusp
- Magnetic / scramble micro-interactions: https://marketplace.framer.com/marketplace/components/magnetic-scramble
- Gamepad API: https://developer.mozilla.org/ko/docs/Web/API/Gamepad_API
