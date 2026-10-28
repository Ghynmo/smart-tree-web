import { Vector3 } from 'three'
import { config } from '../app/config.js'
import { emit } from '../app/state.js'
import { ease } from './tween.js'

const EPS = 1e-4
const ON_AXIS = 0.005 // m; closer than this to the approach line counts as "inside the slot channel"

// Lego-style explode/assemble. Every move starts from the module's *current* position, so a
// request can reverse an animation halfway. Paths per module (data from assembly.json `explode`):
//   assemble: explode → [clear point] → hover point → pause → snap (ease-in-back) into slot + pulse
//   explode:  slot → [clear point] → explode position
// Modules whose explode position equals their slot (the trunk) never move.
// Emits `assembly:state {state, target}` (state: assembled | exploded | transit) and `assembly:snap {id}`.
export class AssemblyController {
  #runs = new Map() // module → current tween handle
  #generation = 0

  constructor(registry, tweens) {
    this.registry = registry
    this.tweens = tweens
    this.state = 'assembled'
    this.target = 'assembled'
    this.movable = registry.list().filter((m) => !vec(m.def.explode.position).equals(vec(m.def.slot.position)))
  }

  toggle() {
    this.go(this.target === 'assembled' ? 'exploded' : 'assembled')
  }

  // target: 'assembled' | 'exploded'. `instant` places modules without animation (chapter jumps).
  go(target, { instant = false } = {}) {
    const generation = ++this.#generation
    for (const run of this.#runs.values()) run.cancel()
    this.#runs.clear()
    this.target = target

    if (instant) {
      for (const m of this.movable) m.setPose(target === 'exploded' ? 'explode' : 'slot')
      return this.#setState(target)
    }

    const assembling = target === 'assembled'
    const s = config.assembly
    const ordered = [...this.movable].sort((a, b) => (assembling ? a.def.order - b.def.order : b.def.order - a.def.order))
    const all = ordered.map((m) => [m, assembling ? this.#assemblePath(m) : this.#explodePath(m)])
    // Already there (within EPS, e.g. a tween cut off at its last frame): snap to the exact pose.
    for (const [m, path] of all) if (!path.length) m.setPose(assembling ? 'slot' : 'explode')
    const plans = all.filter(([, p]) => p.length)

    let pending = plans.length
    if (!pending) return this.#setState(target)
    this.#setState('transit')
    plans.forEach(([m, path], i) => {
      const delay = i * (assembling ? s.assembleStagger : s.explodeStagger)
      this.#runPath(m, path, delay, () => {
        if (generation !== this.#generation) return
        m.root.position.fromArray(assembling ? m.def.slot.position : m.def.explode.position) // exact end pose
        m.pose = assembling ? 'slot' : 'explode'
        if (assembling) {
          emit('assembly:snap', { id: m.id })
          this.#pulse(m)
        }
        if (--pending === 0) this.#setState(target)
      })
    })
  }

  #setState(state) {
    this.state = state
    emit('assembly:state', { state, target: this.target })
  }

  // Geometry of a module's slot channel, relative to its current position.
  #frame(m) {
    const { explode, slot } = m.def
    const s = vec(slot.position)
    const dir = vec(explode.approach).normalize()
    const rel = m.root.position.clone().sub(s)
    const along = rel.dot(dir)
    const lateral = rel.clone().addScaledVector(dir, -along).length()
    const clear = explode.clear ?? 0
    const hover = config.assembly.hover
    return {
      slot: s,
      explode: vec(explode.position),
      clearPoint: s.clone().addScaledVector(dir, clear),
      hoverPoint: s.clone().addScaledVector(dir, hover),
      clear,
      hover,
      along,
      onAxis: lateral < ON_AXIS && along > -EPS && along <= Math.max(clear, hover) + EPS,
    }
  }

  #assemblePath(m) {
    const s = config.assembly
    const f = this.#frame(m)
    if (m.root.position.distanceTo(f.slot) < EPS) return []
    const path = []
    if (!f.onAxis) {
      if (f.clear > f.hover) {
        path.push({ to: f.clearPoint, duration: s.travel, ease: ease.inOutCubic })
        path.push({ to: f.hoverPoint, duration: s.slide, ease: ease.outCubic })
      } else {
        path.push({ to: f.hoverPoint, duration: s.travel, ease: ease.outCubic })
      }
    } else if (f.along > f.hover + EPS) {
      const share = f.clear > f.hover ? (f.along - f.hover) / (f.clear - f.hover) : 1
      path.push({ to: f.hoverPoint, duration: Math.max(s.slide * share, 0.08), ease: ease.outCubic })
    }
    path.push({ to: f.slot, duration: s.snap, ease: ease.inBack, delay: s.pause })
    return path
  }

  #explodePath(m) {
    const s = config.assembly
    const f = this.#frame(m)
    if (m.root.position.distanceTo(f.explode) < EPS) return []
    const path = []
    if (f.onAxis && f.along < f.clear - EPS) path.push({ to: f.clearPoint, duration: s.slide, ease: ease.inOutCubic })
    path.push({ to: f.explode, duration: s.travel, ease: ease.inOutCubic })
    return path
  }

  #runPath(m, path, delay, onDone) {
    const [step, ...rest] = path
    const from = new Vector3()
    const run = this.tweens.add({
      duration: step.duration,
      delay: delay + (step.delay ?? 0),
      ease: step.ease,
      onStart: () => from.copy(m.root.position),
      onUpdate: (t) => m.root.position.lerpVectors(from, step.to, t),
      onComplete: () => (rest.length ? this.#runPath(m, rest, 0, onDone) : onDone()),
    })
    this.#runs.set(m, run)
  }

  // Short emissive flash on snap (SmartModule's 'pulse' glow channel).
  #pulse(m) {
    const { color, strength, duration } = config.assembly.pulse
    this.tweens.add({ duration, ease: ease.outCubic, onUpdate: (t) => m.setGlow('pulse', color, strength * (1 - t)) })
  }
}

const vec = (array) => new Vector3().fromArray(array)
