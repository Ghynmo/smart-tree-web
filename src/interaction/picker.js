import { Raycaster, Vector2 } from 'three'
import { config } from '../app/config.js'
import { emit } from '../app/state.js'
import { PICK_LAYER } from '../modules/SmartModule.js'

const CLICK_SLOP = 6 // px a pointer may travel and still count as a click (not an orbit drag)
const CLICK_MS = 500

// Raycasts against the invisible pick proxies only (never the render meshes).
//   mouse/pen hover → `module:hover {id|null}` + 'hover' glow; touch has no hover
//   click / tap      → `module:select {id}` (empty space selects nothing)
export function createPicker({ dom, camera, registry }) {
  const raycaster = new Raycaster()
  raycaster.layers.set(PICK_LAYER)
  const ndc = new Vector2()
  const picker = { enabled: true, hovered: null, lastMs: 0, pick, setEnabled }
  let down = null
  let pendingMove = null

  // Returns the module id under client coordinates, or null.
  function pick(clientX, clientY) {
    const t0 = performance.now()
    const rect = dom.getBoundingClientRect()
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    const hit = raycaster.intersectObjects(registry.pickables(), false)[0]
    picker.lastMs = performance.now() - t0
    return hit?.object.userData.moduleId ?? null
  }

  function setHover(id) {
    if (id === picker.hovered) return
    if (picker.hovered) registry.get(picker.hovered).setGlow('hover', 0, 0)
    picker.hovered = id
    if (id) registry.get(id).setGlow('hover', config.interaction.hoverGlow.color, config.interaction.hoverGlow.amount)
    dom.style.cursor = id ? 'pointer' : ''
    emit('module:hover', { id })
  }

  function setEnabled(enabled) {
    picker.enabled = enabled
    if (!enabled) setHover(null)
  }

  dom.addEventListener('pointermove', (e) => {
    if (!picker.enabled || e.pointerType === 'touch' || e.buttons) return
    // At most one raycast per frame, however fast the mouse reports.
    if (!pendingMove) requestAnimationFrame(() => {
      setHover(picker.enabled ? pick(pendingMove.x, pendingMove.y) : null)
      pendingMove = null
    })
    pendingMove = { x: e.clientX, y: e.clientY }
  })
  dom.addEventListener('pointerleave', () => setHover(null))
  dom.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() }
  })
  dom.addEventListener('pointerup', (e) => {
    if (!picker.enabled || !down) return
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    const quick = performance.now() - down.t < CLICK_MS
    down = null
    if (moved > CLICK_SLOP || !quick) return
    const id = pick(e.clientX, e.clientY)
    if (id) emit('module:select', { id })
  })

  return picker
}
