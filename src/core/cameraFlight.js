import { Vector3 } from 'three'
import { ease } from '../assembly/tween.js'

// The single owner of camera moves (chapter shots, module focus). A new flight cancels the one
// in progress and starts from wherever the camera is, so requests can interrupt each other.
// OrbitControls are disabled while flying.
export function createCameraFlight({ camera, controls, tweens }) {
  let flight = null

  function cancel() {
    flight?.cancel()
    flight = null
    controls.enabled = true
  }

  // Damped OrbitControls keep rotating with leftover momentum (a user drag, the tour's auto-rotate)
  // for a while; one undamped update consumes it, so a finished flight lands and stays put.
  function clearMomentum() {
    const damping = controls.enableDamping
    controls.enableDamping = false
    controls.update()
    controls.enableDamping = damping
  }

  // position/target: Vector3 or [x, y, z]. duration 0 = jump.
  function fly(position, target, { duration = 1, onDone } = {}) {
    cancel()
    clearMomentum()
    const toPos = toVector(position)
    const toTarget = toVector(target)
    if (duration <= 0) {
      camera.position.copy(toPos)
      controls.target.copy(toTarget)
      camera.lookAt(toTarget)
      controls.dispatchEvent({ type: 'change' }) // a jump moves the camera: request a frame
      onDone?.()
      return
    }
    controls.enabled = false
    const fromPos = camera.position.clone()
    const fromTarget = controls.target.clone()
    flight = tweens.add({
      duration,
      ease: ease.inOutCubic,
      onUpdate: (t) => {
        camera.position.lerpVectors(fromPos, toPos, t)
        controls.target.lerpVectors(fromTarget, toTarget, t)
        camera.lookAt(controls.target)
      },
      onComplete: () => {
        flight = null
        controls.enabled = true
        onDone?.()
      },
    })
  }

  return { fly, cancel, get flying() { return flight !== null } }
}

const toVector = (v) => (v.isVector3 ? v.clone() : new Vector3().fromArray(v))
