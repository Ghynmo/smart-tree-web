import { animate, stagger } from 'motion'

// Shared UI motion (Motion, the vanilla build of Framer Motion). Every entrance in the overlay goes
// through these presets so the whole interface moves with one spring "personality".
// Only transform + opacity are animated (compositor-only: never triggers a 3D re-render or layout).
// No per-frame text tweens: re-rastering a large panel every frame cost ~35 ms per frame on an
// Intel HD 4000 (Tahap 16), so dashboard numbers stay at their plain 2 Hz update.
// prefers-reduced-motion: elements are shown in their final state immediately.
const reduced = matchMedia('(prefers-reduced-motion: reduce)')

export const SPRING = { type: 'spring', visualDuration: 0.5, bounce: 0.18 }
const SNAPPY = { type: 'spring', visualDuration: 0.32, bounce: 0.12 }

const finish = (elements) => {
  for (const el of elements) {
    el.style.opacity = ''
    el.style.transform = ''
  }
}

// Children rise in one after another (chapter change, panel open).
export function enterStagger(elements, { y = 14, delay = 0, gap = 0.055 } = {}) {
  const list = [...elements].filter(Boolean)
  if (!list.length) return
  if (reduced.matches) return finish(list)
  animate(list, { opacity: [0, 1], y: [y, 0] }, { ...SPRING, delay: stagger(gap, { startDelay: delay }) })
}

// A panel slides in from a screen side: 'inline-end' (mirrors in RTL) or 'bottom' (phone sheets).
export function enterPanel(element, from = 'inline-end') {
  if (reduced.matches) return finish([element])
  const sign = document.dir === 'rtl' ? -1 : 1
  const offset = from === 'bottom' ? { y: [28, 0] } : from === 'inline-start' ? { x: [-24 * sign, 0] } : { x: [24 * sign, 0] }
  animate(element, { opacity: [0, 1], ...offset }, SPRING)
}

// Opacity-only entrance for panels whose bounds feed `view:inset` (a transform would skew them).
export function fadeIn(element) {
  if (reduced.matches) return finish([element])
  animate(element, { opacity: [0, 1] }, { duration: 0.35, ease: [0.22, 1, 0.36, 1] })
}

// Slides an absolutely positioned indicator (language pill) to a new inline offset and width.
export function slideTo(element, { x, width }, { instant = false } = {}) {
  animate(element, { x, inlineSize: `${width}px` }, instant || reduced.matches ? { duration: 0 } : SNAPPY)
}

