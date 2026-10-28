// Tiny tween runner driven by the render loop (pauses with it when the tab is hidden).

export const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  // Pulls back slightly before accelerating in: the "snap" of a Lego brick.
  inBack: (t) => 2.70158 * t ** 3 - 1.70158 * t ** 2,
  // Overshoots slightly and settles: growth that "springs" into place.
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  inCubic: (t) => t ** 3,
}

export class Tweens {
  #active = new Set()

  // onStart runs when the delay has elapsed (capture "from" values there); onUpdate(easedT);
  // onComplete is skipped if the tween is cancelled. Returns { cancel }.
  add({ duration, delay = 0, ease: easing = ease.linear, onStart, onUpdate, onComplete }) {
    const tween = { elapsed: -delay, duration: Math.max(duration, 1e-6), easing, onStart, onUpdate, onComplete, started: false }
    this.#active.add(tween)
    return { cancel: () => this.#active.delete(tween) }
  }

  update(dt) {
    for (const tw of this.#active) {
      tw.elapsed += dt
      if (tw.elapsed < 0) continue
      if (!tw.started) {
        tw.started = true
        tw.onStart?.()
      }
      const t = Math.min(tw.elapsed / tw.duration, 1)
      tw.onUpdate?.(tw.easing(t))
      if (t === 1) {
        this.#active.delete(tw)
        tw.onComplete?.()
      }
    }
  }

  get busy() {
    return this.#active.size > 0
  }
}
