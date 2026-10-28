import { PerspectiveCamera } from 'three'
import { config } from '../app/config.js'

export function createCamera() {
  const { fov, near, far, position } = config.camera
  const camera = new PerspectiveCamera(fov, 1, near, far)
  camera.position.fromArray(position)
  return camera
}
