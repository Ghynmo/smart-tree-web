import { config } from '../app/config.js'
import { ease } from '../assembly/tween.js'

// Fades module opacity (x-ray) with a cancellable tween, so chapter changes can reverse it midway.
// Usage: xray.set('trunk_base', 0.22) … xray.set('trunk_base', 1)
export function createXray({ registry, tweens }) {
  const fades = new Map() // id → tween handle

  function set(id, opacity, { instant = false } = {}) {
    const m = registry.get(id)
    fades.get(id)?.cancel()
    fades.delete(id)
    const from = m.opacity ?? 1
    if (instant || from === opacity) return m.setOpacity(opacity)
    fades.set(
      id,
      tweens.add({
        duration: config.water.fade,
        ease: ease.inOutCubic,
        onUpdate: (t) => m.setOpacity(from + (opacity - from) * t),
        onComplete: () => fades.delete(id),
      }),
    )
  }

  return { set, get busy() { return fades.size > 0 } }
}
