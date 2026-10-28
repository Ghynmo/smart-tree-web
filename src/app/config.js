// Runtime tuning that is not per-module data (per-module values live in src/data/assembly.json).

const DEG = Math.PI / 180

export const config = {
  // aa: 'fxaa' (post pass, can be switched off at runtime) | 'msaa' (fixed at context creation) | 'none'
  // lighting: 'env' (PMREM) | 'probe' (LightProbe, cheaper) — see core/scene.js
  // URL overrides for checks: ?quality=low|high  ?aa=fxaa|msaa|none  ?lighting=env|probe
  quality: {
    // textureScale: textures shrunk in the browser before upload (low: 2048² crown → 1024², others → 512²),
    // ~60 MB of texture memory instead of ~230 MB (iOS Safari).
    high: { maxDpr: 2, variant: 'desktop', aa: 'fxaa', lighting: 'env', textureScale: 1 },
    // AA only pays off on DPR 1 screens; on dense mobile screens it costs more than it gains.
    low: { maxDpr: 1.5, variant: 'mobile', aa: 'none', lighting: 'probe', textureScale: 0.5 },
  },
  // Auto downgrade high → low when FPS stays under minFps for `seconds` consecutive 1 s windows.
  // Watching starts `warmupMs` after the core modules are shown (skips shader-compile hitches).
  // Steps after the tier switch: render-resolution scale (relative to the tier's pixel ratio).
  adaptive: { minFps: 50, seconds: 3, warmupMs: 2000, cooldown: 3, resolutionSteps: [0.85, 0.7] },
  loading: {
    // Load order by assembly.json `group`. Phase 0 gates the loading screen; later phases stream in the background.
    phases: [['structure', 'internal'], ['exterior'], ['branch']],
    proxies: '/models/proxies.glb', // pick proxies, built by `npm run models:proxies`
    retries: 1,
    // Share of a module's progress given to the download; the rest completes after GLB parsing.
    downloadWeight: 0.9,
  },
  // Lego-style explode/assemble (src/assembly). Seconds and meters; paths come from assembly.json.
  assembly: {
    hover: 0.025, // pause point before the snap, along explode.approach
    travel: 0.6, // explode position ↔ clear/hover point
    slide: 0.25, // clear point ↔ hover point (in/out of a trunk compartment)
    pause: 0.1,
    snap: 0.22, // hover → slot, ease-in-back
    assembleStagger: 0.45, // next module starts while the previous one is still settling
    explodeStagger: 0.07,
    pulse: { color: 0x7fd36b, strength: 0.6, duration: 0.45 },
  },
  interaction: {
    hoverGlow: { color: 0x7fd36b, amount: 0.18 },
    highlightGlow: { color: 0x7fd36b, amount: 0.3 }, // modules linked to a hovered roadmap item
    focusDuration: 0.9, // s, camera fly-to and fly-back
    labelOffset: 0.04, // m above the hovered module's bounds
  },
  story: {
    cameraDuration: 1.4, // s, fly between chapter shots
    growDuration: 1.6, // s, tree grows out of the ground (intro → reveal)
    shrinkDuration: 0.6, // s, tree sinks back (→ intro)
    maxShotDistance: 12, // m, cap for shots fitted to narrow screens (may exceed controls.maxDistance)
    swipeMin: 60, // px horizontal travel for a swipe on the story card / chapter nav
  },
  // Closed-loop water (chapter d); path data in src/data/waterPath.json.
  water: {
    speed: 0.12, // m/s of the dashes and drops at full pump power
    pumpResponse: 1.5, // 1/s, how fast the flow follows the pump switching on/off
    tubeRadius: 0.006,
    dashSpacing: 0.06, // m between dash pulses
    particles: { high: 120, low: 48 },
    particleRadius: 0.008,
    colors: { base: 0x1d6fa5, bright: 0x8fe3ff, drop: 0xb8f0ff },
    xrayOpacity: 0.22, // trunk_base opacity while the water is shown
    fade: 0.6, // s, show/hide and x-ray transition
  },
  camera: {
    fov: 35,
    near: 0.05,
    far: 50,
    position: [0, 1.25, 4.4],
    target: [0, 0.9, 0],
  },
  controls: {
    minDistance: 1.2,
    maxDistance: 7,
    minPolarAngle: 15 * DEG,
    maxPolarAngle: 88 * DEG,
    dampingFactor: 0.08,
  },
  scene: {
    // Sand disc under the tree (procedural texture, rim fades into the CSS sky; see core/scene.js).
    ground: { color: 0x9e8062, radius: 3.6, repeat: 7, fadeStart: 0.12 },
    // Late-afternoon desert light: warm sun, violet sky bounce, sand-colored ground bounce.
    light: {
      sky: 0xffe2c4,
      ground: 0x5a4030,
      hemisphere: 0.65,
      sun: 0xffe0b8,
      sunIntensity: 1.3,
      sunPosition: [2.4, 3.6, 3],
    },
    shadow: { radius: 0.75, opacity: 0.45 },
    probeIntensity: 1, // LightProbe lighting (see core/scene.js)
  },
}
