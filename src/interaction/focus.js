import { Vector3 } from 'three'
import { config } from '../app/config.js'
import { on } from '../app/state.js'

// Camera fly-to on `module:select {id}` and back on `module:select {id: null}`.
// Target = center of the module bounds; camera = target + normalize(focus.direction) × focus.distance
// (assembly.json). The pose before the first selection is remembered and restored on close.
// `module:select {id: null, reason: 'chapter'}` only forgets that pose: the chapter flies the camera.
export function createFocus({ camera, controls, registry, flight }) {
  let home = null // { position, target } before the first selection

  function focus(id) {
    const m = registry.get(id)
    if (!m) return
    if (!home) home = { position: camera.position.clone(), target: controls.target.clone() }
    const box = m.worldBox()
    const target = box.getCenter(new Vector3())
    const distance = Math.min(Math.max(m.def.focus.distance, fitDistance(box)), config.controls.maxDistance)
    const position = target.clone().addScaledVector(new Vector3().fromArray(m.def.focus.direction).normalize(), distance)
    // Close-ups of small modules need a shorter minimum zoom than the overview.
    controls.minDistance = Math.min(config.controls.minDistance, distance * 0.7)
    flight.fly(position, target, { duration: config.interaction.focusDuration })
  }

  // focus.distance is tuned for landscape screens; on narrow (portrait) screens back off until
  // the module's horizontal extent fits the horizontal field of view, with 10 % margin.
  function fitDistance(box) {
    const halfWidth = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2
    const halfHfov = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect)
    return (halfWidth / Math.tan(halfHfov)) * 1.1
  }

  function release({ fly }) {
    if (!home) return
    const { position, target } = home
    home = null
    controls.minDistance = config.controls.minDistance
    if (fly) flight.fly(position, target, { duration: config.interaction.focusDuration })
  }

  on('module:select', ({ id, reason }) => (id ? focus(id) : release({ fly: reason !== 'chapter' })))

  return { get focused() { return home !== null } }
}
