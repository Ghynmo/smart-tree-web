import { AssemblyController } from '../assembly/AssemblyController.js'
import { Tweens } from '../assembly/tween.js'
import { createCamera } from '../core/camera.js'
import { createCameraFlight } from '../core/cameraFlight.js'
import { guardContext } from '../core/contextGuard.js'
import { createControls } from '../core/controls.js'
import { createLoop } from '../core/loop.js'
import { createPipeline } from '../core/pipeline.js'
import { detectQuality, watchFps, withOverrides } from '../core/quality.js'
import { createRenderer } from '../core/renderer.js'
import { createScene, setLighting } from '../core/scene.js'
import { createViewport } from '../core/viewport.js'
import assembly from '../data/assembly.json'
import manifest from '../data/models.manifest.json'
import { createFocus } from '../interaction/focus.js'
import { createHighlight } from '../interaction/highlight.js'
import { createPicker } from '../interaction/picker.js'
import { ModuleRegistry } from '../modules/ModuleRegistry.js'
import waterPath from '../data/waterPath.json'
import { WaterFlow } from '../water/WaterFlow.js'
import { createXray } from '../water/xray.js'
import { StoryController } from '../story/StoryController.js'
import { CHAPTER_DEFS } from '../story/chapters/index.js'
import { createTour } from '../story/tour.js'
import { TOUR } from '../data/tour.js'
import { createHoverLabel } from '../ui/labels.js'
import { config } from './config.js'
import { emit, on, onAny } from './state.js'

const debug = new URLSearchParams(location.search).has('debug')
// The current chapter survives a reload (accidental F5, recovery after a GPU failure) for this tab.
const CHAPTER_KEY = 'smarttree.chapter'

function readSavedChapter() {
  try {
    const index = Number(sessionStorage.getItem(CHAPTER_KEY))
    return Number.isInteger(index) && index >= 0 && index < CHAPTER_DEFS.length ? index : 0
  } catch {
    return 0 // storage blocked: start at the beginning
  }
}

function saveChapter(index) {
  try {
    sessionStorage.setItem(CHAPTER_KEY, String(index))
  } catch {
    // storage blocked: a reload simply starts at chapter 1
  }
}

export async function startApp(container) {
  let quality = detectQuality()
  emit('quality:change', { name: quality.name, resolutionScale: 1, reason: 'initial' }) // UI styling (body[data-quality])
  const renderer = createRenderer(quality)
  container.append(renderer.domElement)

  const scene = createScene(renderer, { lighting: quality.lighting })
  const camera = createCamera()
  const controls = createControls(camera, renderer.domElement)

  const viewport = createViewport({ camera, container })
  let pipeline = null // created below; resize() also runs before they exist
  let loop = null
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container
    renderer.setSize(w, h)
    camera.aspect = w / h
    viewport.apply() // re-centers into the area left free by overlay panels; updates the projection
    pipeline?.resize()
    loop?.invalidate()
  }
  on('view:inset', ({ source, ...insets }) => viewport.setInsets(source, insets))
  new ResizeObserver(resize).observe(container)
  resize()

  const registry = new ModuleRegistry(manifest, assembly)
  scene.add(registry.tree)

  const tweens = new Tweens()
  const assemblyController = new AssemblyController(registry, tweens)
  // target omitted = toggle
  on('assembly:go', ({ target, instant } = {}) =>
    target ? assemblyController.go(target, { instant }) : assemblyController.toggle(),
  )

  pipeline = createPipeline({ renderer, scene, camera })
  pipeline.setFxaa(quality.aa === 'fxaa' && renderer.getPixelRatio() <= 1.5)
  loop = createLoop(renderer, pipeline.render)
  loop.add((dt) => tweens.update(dt))
  const flight = createCameraFlight({ camera, controls, tweens })
  // Skipped during flights so OrbitControls' distance/polar clamps never fight the tween.
  loop.add(() => flight.flying || controls.update())
  // Render on demand: any bus event or camera change draws new frames; tweens and auto-rotate
  // keep drawing while they run (water registers its own activity below).
  onAny(() => loop.invalidate())
  controls.addEventListener('change', () => loop.invalidate())
  loop.addActivity(() => tweens.busy || controls.autoRotate)

  const picker = createPicker({ dom: renderer.domElement, camera, registry })
  const focus = createFocus({ camera, controls, registry, flight })
  createHoverLabel({ container, camera, registry, loop })
  createHighlight({ registry })
  const water = new WaterFlow({ path: waterPath, qualityName: quality.name, tweens, loop })
  registry.tree.add(water.group) // tree space, so it grows and scales with the tree
  loop.addActivity(() => water.group.visible && water.flow > 0)
  const xray = createXray({ registry, tweens })
  const story = new StoryController({
    chapters: CHAPTER_DEFS, shots: assembly.shots, registry, assemblyController, flight, controls, picker, tweens, viewport,
    services: { water, xray },
  })
  on('chapter:change', ({ index }) => saveChapter(index))
  story.go(readSavedChapter(), { instant: true })
  const tour = createTour({ script: TOUR, story, controls, loop })
  loop.start()

  // Context loss: three.js re-uploads meshes and textures itself; rebuild what lived only on the GPU.
  guardContext(renderer, {
    onLost: () => emit('webgl:lost'),
    onRestored: async () => {
      pipeline.rebuild()
      await setLighting(renderer, scene, quality.lighting, { force: true })
      loop.invalidate()
      emit('webgl:restored')
    },
  })

  // Downgrade ladder, one step per call (FPS watcher): high → low tier (no AA, probe lighting,
  // smaller textures, lighter model files swapped in the background), then lower render
  // resolution (config.adaptive.resolutionSteps). Returns true while further steps remain.
  // MSAA (only with ?aa=msaa) cannot be removed without a new WebGL context.
  let resolutionScale = 1
  const nextScale = () => config.adaptive.resolutionSteps.find((step) => step < resolutionScale)
  function applyPixelRatio() {
    renderer.setPixelRatio(Math.min(devicePixelRatio, quality.maxDpr) * resolutionScale)
    resize()
  }
  function downgrade(reason) {
    if (quality.name !== 'low') {
      quality = withOverrides({ name: 'low', forced: quality.forced, ...config.quality.low })
      registry.textureScale = quality.textureScale
      pipeline.setFxaa(quality.aa === 'fxaa')
      setLighting(renderer, scene, quality.lighting).then(() => loop.invalidate())
      applyPixelRatio()
      registry.setVariant(quality.variant)
    } else {
      const scale = nextScale()
      if (scale === undefined) return false
      resolutionScale = scale
      applyPixelRatio()
    }
    emit('quality:change', { name: quality.name, resolutionScale, reason })
    return nextScale() !== undefined
  }

  let fpsWatcher = null
  const app = { renderer, scene, camera, controls, registry, loop, assembly, assemblyController, tweens, flight, picker, focus, story, tour, viewport, water, pipeline, get quality() { return quality }, get fps() { return fpsWatcher?.fps ?? null }, get resolutionScale() { return resolutionScale }, downgrade }
  // Debug handle; `emit`/`on` give tests the app's own bus (a separate import may load another copy).
  if (debug) window.__smartTree = Object.assign(app, { emit, on })

  registry.textureScale = quality.textureScale
  const loaded = registry.loadStaged(quality.variant, {
    ...config.loading,
    onProgress: (e) => emit('load:progress', e),
    onPhase: (e) => {
      emit('load:phase', e)
      // ?tour=1 (kiosk/booth): start the auto tour as soon as the loading screen is gone.
      if (e.phase === 0 && !e.failed.length && new URLSearchParams(location.search).get('tour') === '1') tour.play()
      if (e.phase === 0 && !e.failed.length && !quality.forced) {
        setTimeout(() => {
          fpsWatcher = watchFps(loop, config.adaptive, (fps) => downgrade({ fps: Math.round(fps) }))
        }, config.adaptive.warmupMs)
      }
      if (e.last) emit('modules:loaded', { registry })
    },
  })

  if (debug) {
    await loaded
    const { createDebugPanel } = await import('../debug/debugPanel.js')
    createDebugPanel(app)
  }

  return app
}
