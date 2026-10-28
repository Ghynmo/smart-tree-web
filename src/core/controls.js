import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { config } from '../app/config.js'

// Orbit limited so the audience never sees under the ground or loses the tree.
export function createControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement)
  Object.assign(controls, config.controls)
  controls.enableDamping = true
  controls.enablePan = false
  controls.target.fromArray(config.camera.target)
  controls.update()
  return controls
}
