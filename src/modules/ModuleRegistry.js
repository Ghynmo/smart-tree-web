import { Group } from 'three'
import { downscaleTextures, loadModel } from '../assets/loader.js'
import { SmartModule } from './SmartModule.js'

// Builds every module from manifest (generated) + assembly (manual) and owns the `tree` group.
export class ModuleRegistry {
  constructor(manifest, assembly) {
    this.assembly = assembly
    this.tree = new Group()
    this.tree.name = 'tree'
    this.modules = new Map()
    this.variant = null
    this.textureScale = 1 // < 1 shrinks textures before upload (low tier, see config.quality)
    this.loading = Promise.resolve()

    const entries = Object.entries(assembly.modules).sort((a, b) => a[1].order - b[1].order)
    for (const [id, def] of entries) {
      const entry = manifest.modules[id]
      if (!entry) throw new Error(`Module "${id}" is in assembly.json but missing from models.manifest.json`)
      const module = new SmartModule(id, def, entry)
      this.modules.set(id, module)
      this.tree.add(module.root)
    }
  }

  get(id) {
    return this.modules.get(id)
  }

  list() {
    return [...this.modules.values()]
  }

  // Loads modules phase by phase; `phases` lists assembly groups per phase (config.loading.phases).
  // Modules within a phase load in parallel. Callbacks:
  //   onProgress({ phase, phaseRatio, ratio, backgroundRatio })
  //     ratios are 0..1 weighted by manifest bytes; ratio = whole load, backgroundRatio = phases 1+
  //   onPhase({ phase, last, failed })           failed = ids that could not be loaded
  // A failure in phase 0 stops the load (nothing useful to show); later failures are skipped.
  // Pick proxies (`proxies` URL, one small file) load alongside phase 0 and are attached before
  // phase 0 is reported; without them the scene still shows, only picking is unavailable.
  loadStaged(variant, { phases, proxies, retries = 0, downloadWeight = 0.9, onProgress, onPhase } = {}) {
    this.variant = variant
    const plan = phases.map((groups) => this.list().filter((m) => groups.includes(m.def.group)))
    const all = plan.flat()
    const unplanned = this.list().filter((m) => !all.includes(m))
    if (unplanned.length) throw new Error(`No load phase for: ${unplanned.map((m) => m.id).join(', ')}`)

    const bytes = (m) => m.entry[variant].bytes
    const weighted = (list) => list.reduce((acc, m) => acc + progress.get(m) * bytes(m), 0)
    const totalOf = (list) => list.reduce((acc, m) => acc + bytes(m), 0)
    const progress = new Map(all.map((m) => [m, 0]))
    const background = plan.slice(1).flat()
    const ratioOf = (list) => (list.length ? weighted(list) / totalOf(list) : 1)

    const proxiesLoaded = proxies ? this.#loadProxies(proxies, retries) : Promise.resolve()

    const run = async () => {
      for (const [phase, list] of plan.entries()) {
        const report = () =>
          onProgress?.({ phase, phaseRatio: ratioOf(list), ratio: ratioOf(all), backgroundRatio: ratioOf(background) })
        const track = (m, ratio) => {
          progress.set(m, ratio)
          report()
        }
        report()
        const results = await Promise.allSettled(
          list.map((m) =>
            this.#load(m, this.variant, { retries, onProgress: (r) => track(m, r * downloadWeight) }).then(() => track(m, 1)),
          ),
        )
        const failed = []
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') return
          failed.push(list[i].id)
          console.error(`[load] ${list[i].id}:`, r.reason)
        })
        if (phase === 0) await proxiesLoaded
        onPhase?.({ phase, last: phase === plan.length - 1, failed })
        if (phase === 0 && failed.length) return
      }
    }
    this.loading = run()
    return this.loading
  }

  // Switches every module to another file variant (e.g. after an FPS downgrade). Modules still
  // queued pick up the new variant themselves; loaded ones are reloaded one at a time after the
  // staged load has finished, so the swap never competes with first-time loading.
  async setVariant(variant) {
    this.variant = variant
    await this.loading
    for (const m of this.list()) {
      if (this.variant !== variant) return // superseded by a newer call
      if (!m.model || m.variant === variant) continue
      try {
        await this.#load(m, variant)
      } catch (err) {
        console.error(`[load] ${m.id} (${variant}):`, err) // keep the model already shown
      }
    }
  }

  async #loadProxies(url, retries) {
    try {
      const scene = await loadModel(url, { retries })
      for (const m of this.list()) {
        const mesh = scene.getObjectByName(m.id)
        if (mesh?.isMesh) m.setProxy(mesh)
        else console.error(`[load] no pick proxy for ${m.id}`)
      }
    } catch (err) {
      console.error('[load] pick proxies:', err)
    }
  }

  // Modules that can be picked right now (model shown and proxy attached).
  pickables() {
    return this.list().filter((m) => m.model && m.proxy && m.root.visible).map((m) => m.proxy)
  }

  async #load(m, variant, { retries = 0, onProgress } = {}) {
    const model = await loadModel(m.url(variant), { expectedBytes: m.entry[variant].bytes, retries, onProgress })
    downscaleTextures(model, this.textureScale)
    m.setModel(model, variant)
  }

  dispose() {
    for (const m of this.list()) m.dispose()
    this.modules.clear()
  }
}
