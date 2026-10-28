import { Vector3 } from 'three'
import { config } from '../app/config.js'
import { emit, on } from '../app/state.js'
import { ease } from '../assembly/tween.js'

// Owns the current chapter. Answers `chapter:go {index}` with `chapter:change {index, id, ui}`.
// Every chapter declares its *target* state (camera shot, tree grown, assembly, picking, overlay);
// entering applies all of it from whatever the scene looks like now, so arriving at chapter N
// from any chapter, even mid-transition, ends in the same view (idempotent).
export class StoryController {
  #treeTween = null

  // services: chapter-specific helpers handed to enter/exit (e.g. { water, xray }).
  constructor({ chapters, shots, registry, assemblyController, flight, controls, picker, tweens, viewport, services = {} }) {
    Object.assign(this, { chapters, shots, registry, assemblyController, flight, controls, picker, tweens, viewport, services })
    this.index = -1
    on('chapter:go', ({ index }) => this.go(index))
  }

  get current() {
    return this.chapters[this.index]
  }

  // instant: no animation (first paint).
  go(index, { instant = false } = {}) {
    if (index < 0 || index >= this.chapters.length) return
    if (index === this.index && !instant) return
    const ctx = { ...this.services, registry: this.registry, assemblyController: this.assemblyController, flight: this.flight, tweens: this.tweens, instant }
    this.current?.exit?.(ctx)

    const def = this.chapters[index]
    this.index = index
    emit('module:select', { id: null, reason: 'chapter' }) // close the info panel, forget focus pose
    emit('chapter:change', { index, id: def.id, ui: def.ui ?? {} })

    this.picker.setEnabled(def.interactive)
    const { position, target } = this.#shotPose(this.shots[def.id])
    // A fitted shot may sit beyond the orbit limit (narrow screens); let the user orbit there too.
    this.controls.maxDistance = Math.max(config.controls.maxDistance, position.distanceTo(target) + 0.01)
    this.flight.fly(position, target, { duration: instant ? 0 : config.story.cameraDuration })
    this.#setTree(def.tree, instant)
    // A hidden tree is always stored assembled, so growing it never shows a half-exploded tree.
    this.assemblyController.go(def.tree ? def.assembly : 'assembled', { instant: instant || !def.tree })
    def.enter?.(ctx)
  }

  // Shot from assembly.json; with `fit` [w, h] the camera backs off along the shot direction until
  // the subject fits the screen area left free by overlay panels (never closer than the shot).
  #shotPose({ position, target, fit }) {
    if (!fit) return { position: new Vector3().fromArray(position), target: new Vector3().fromArray(target) }
    const t = new Vector3().fromArray(target)
    const dir = new Vector3().fromArray(position).sub(t)
    const distance = Math.min(Math.max(dir.length(), this.viewport.fitDistance(...fit)), config.story.maxShotDistance)
    return { position: t.clone().addScaledVector(dir.normalize(), distance), target: t }
  }

  // Grows the whole tree from the ground (origin = ground at trunk center) or sinks it back.
  #setTree(grown, instant) {
    const tree = this.registry.tree
    const to = grown ? 1 : 0
    this.#treeTween?.cancel()
    this.#treeTween = null
    if (instant || tree.scale.x === to) {
      tree.scale.setScalar(to)
      tree.visible = grown
      return
    }
    const from = tree.scale.x
    tree.visible = true
    this.#treeTween = this.tweens.add({
      duration: grown ? config.story.growDuration : config.story.shrinkDuration,
      ease: grown ? ease.outBack : ease.inCubic,
      onUpdate: (t) => tree.scale.setScalar(Math.max(from + (to - from) * t, 1e-4)),
      onComplete: () => {
        tree.scale.setScalar(to)
        tree.visible = grown
        this.#treeTween = null
      },
    })
  }

  // True when no chapter transition is still animating (camera, tree, assembly, chapter effects).
  get settled() {
    const effects = Object.values(this.services).every((s) => !s.busy && !s.fading)
    return effects && !this.flight.flying && !this.#treeTween && this.assemblyController.state !== 'transit'
  }
}
