import { on } from '../app/state.js'

const PARALLAX = 14 // px of drift at the screen edge

// Dusk sky behind the transparent 3D canvas. The intro shows the Arafah illustration (cross-faded
// by CSS on `data-chapter`), with a gentle pointer parallax on fine pointers.
// Also mirrors the quality tier on <body data-quality> so CSS can drop costly effects on `low`.
export function createBackdrop(backdrop) {
  const hero = backdrop.querySelector('.backdrop__hero')
  const fine = matchMedia('(hover: hover) and (pointer: fine)')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  let intro = false
  let frame = 0
  let target = { x: 0, y: 0 }

  function drift() {
    frame = 0
    hero.style.translate = intro ? `${target.x.toFixed(1)}px ${target.y.toFixed(1)}px` : ''
  }

  addEventListener(
    'pointermove',
    (e) => {
      if (!intro || !fine.matches || reduced.matches || e.pointerType !== 'mouse') return
      target = { x: -((e.clientX / innerWidth) * 2 - 1) * PARALLAX, y: -((e.clientY / innerHeight) * 2 - 1) * PARALLAX * 0.5 }
      frame ||= requestAnimationFrame(drift)
    },
    { passive: true },
  )

  on('chapter:change', ({ id }) => {
    backdrop.dataset.chapter = id
    intro = id === 'intro'
    if (!intro) drift()
  })
  on('quality:change', ({ name }) => (document.body.dataset.quality = name))
}
