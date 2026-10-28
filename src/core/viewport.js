// Keeps the 3D subject in the part of the screen not covered by overlay panels.
// UI panels report covered edges in CSS px (`view:inset {source, top, right, bottom, left}`, physical
// sides); each source replaces its own previous report and the largest inset per side wins.
// the projection center is shifted into the free rectangle with camera.setViewOffset (no zoom,
// no camera move), and fitDistance() tells chapter shots how far back a subject must be to fit.
const MARGIN = 0.9 // subject may fill 90 % of the free rectangle

export function createViewport({ camera, container }) {
  const NONE = { top: 0, right: 0, bottom: 0, left: 0 }
  const sources = new Map() // source → insets
  let insets = NONE

  function free() {
    const W = container.clientWidth
    const H = container.clientHeight
    const w = Math.max(W - insets.left - insets.right, W * 0.3)
    const h = Math.max(H - insets.top - insets.bottom, H * 0.3)
    return { W, H, w, h, cx: insets.left + w / 2, cy: insets.top + h / 2 }
  }

  // Call after every resize (camera.aspect already updated) and whenever insets change.
  function apply() {
    const { W, H, cx, cy } = free()
    if (!W || !H) return
    const x = W / 2 - cx
    const y = H / 2 - cy
    if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) camera.clearViewOffset()
    else camera.setViewOffset(W, H, x, y, W, H)
    camera.updateProjectionMatrix()
  }

  function setInsets(source, next) {
    sources.set(source, { ...NONE, ...next })
    insets = { ...NONE }
    for (const s of sources.values()) for (const side of Object.keys(NONE)) insets[side] = Math.max(insets[side], s[side])
    apply()
  }

  // Camera distance at which a subject of `width` × `height` meters fits the free rectangle.
  function fitDistance(width, height) {
    const { H, w, h } = free()
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360)
    // Pixels per meter at distance d = H / (2 d tanHalf); solve for d on both axes.
    return Math.max((height * H) / h, (width * H) / w) / (2 * tanHalf * MARGIN)
  }

  return { apply, setInsets, fitDistance, get insets() { return insets } }
}
