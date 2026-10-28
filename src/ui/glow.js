// Pointer-following gold glow on panel borders (CSS in overlay.css: `.panel::after`).
// Fine pointers only; one listener for the whole overlay, at most one style write per frame.
// Off in the low quality tier (CSS hides the layer) and with reduced motion.
export function initPanelGlow() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  let current = null
  let pending = null

  function apply() {
    const { panel, x, y } = pending
    pending = null
    if (panel !== current) {
      current?.removeAttribute('data-glow')
      current = panel
      current?.setAttribute('data-glow', '')
    }
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    panel.style.setProperty('--mx', `${x - rect.left}px`)
    panel.style.setProperty('--my', `${y - rect.top}px`)
  }

  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return
      const panel = e.target.closest?.('.panel') ?? null
      if (!pending) requestAnimationFrame(apply)
      pending = { panel, x: e.clientX, y: e.clientY }
    },
    { passive: true },
  )
  document.documentElement.addEventListener('pointerleave', () => {
    current?.removeAttribute('data-glow')
    current = null
  })
}
