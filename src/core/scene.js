import {
  CanvasTexture,
  CubeCamera,
  HalfFloatType,
  CircleGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  WebGLCubeRenderTarget,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { LightProbeGenerator } from 'three/addons/lights/LightProbeGenerator.js'
import { config } from '../app/config.js'

// No shadow maps: ambient light comes from a RoomEnvironment, grounding from a blob texture.
// lighting 'env':   PMREM environment map (image-based, includes soft reflections).
// lighting 'probe': the same room baked into a LightProbe (spherical harmonics): diffuse only, no
//                   per-pixel texture lookups. ~30 % cheaper per frame on weak GPUs (Tahap 14).
// No scene.background: the canvas is transparent and the dusk sky is a CSS layer behind it
// (src/ui/backdrop.js), so it looks identical on every tier and costs no fill rate.
// The sand disc fades out at its rim, blending the stage into that sky.
export function createScene(renderer, { lighting = 'env' } = {}) {
  const scene = new Scene()
  setLighting(renderer, scene, lighting)

  const { ground, shadow, light } = config.scene
  scene.add(new HemisphereLight(light.sky, light.ground, light.hemisphere))
  const sun = new DirectionalLight(light.sun, light.sunIntensity)
  sun.position.set(...light.sunPosition)
  scene.add(sun)

  const sand = createSandTexture()
  sand.repeat.set(ground.repeat, ground.repeat)
  const groundMesh = new Mesh(
    new CircleGeometry(ground.radius, 64),
    new MeshStandardMaterial({
      color: ground.color,
      map: sand,
      alphaMap: createRimFadeTexture(ground.fadeStart),
      transparent: true,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
    }),
  )
  groundMesh.rotation.x = -Math.PI / 2
  groundMesh.renderOrder = -1 // first of the transparent pass: under the blob, x-ray trunk and water
  scene.add(groundMesh)

  const blob = new Mesh(
    new CircleGeometry(shadow.radius, 48),
    new MeshBasicMaterial({ map: createBlobTexture(), transparent: true, opacity: shadow.opacity, depthWrite: false }),
  )
  blob.rotation.x = -Math.PI / 2
  blob.position.y = 0.002
  scene.add(blob)

  return scene
}

// Switches the ambient lighting at runtime (the quality downgrade moves 'env' → 'probe').
// force: rebuild even if unchanged (after a WebGL context loss the PMREM texture is gone).
// Returns a promise that resolves once the new lighting is in the scene.
export async function setLighting(renderer, scene, mode, { force = false } = {}) {
  const { userData } = scene
  if (userData.lighting === mode && !force) return
  userData.lighting = mode
  if (mode === 'probe') {
    const probe = await bakeRoomProbe(renderer)
    if (userData.lighting !== 'probe') return // switched again meanwhile
    scene.environment = null
    userData.envTexture?.dispose()
    userData.envTexture = null
    userData.probe = probe
    scene.add(probe)
  } else {
    const pmrem = new PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    userData.envTexture?.dispose()
    userData.envTexture = pmrem.fromScene(room, 0.04).texture
    scene.environment = userData.envTexture
    room.dispose()
    pmrem.dispose()
    userData.probe?.removeFromParent()
    userData.probe = null
  }
}

// Bakes the RoomEnvironment into a LightProbe (async GPU readback of a small cube map).
async function bakeRoomProbe(renderer) {
  const room = new RoomEnvironment()
  const target = new WebGLCubeRenderTarget(32, { type: HalfFloatType })
  new CubeCamera(0.1, 100, target).update(renderer, room)
  const probe = await LightProbeGenerator.fromCubeRenderTarget(renderer, target)
  probe.intensity = config.scene.probeIntensity
  room.dispose()
  target.dispose()
  return probe
}

// Fine desert sand: warm base, grain speckle and faint wind ripples (procedural, seeded, no file).
function createSandTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#e2cfa8'
  ctx.fillRect(0, 0, size, size)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 9000; i++) {
    const light = rnd() < 0.5
    ctx.fillStyle = light ? `rgba(255,246,226,${0.25 + rnd() * 0.3})` : `rgba(120,88,58,${0.12 + rnd() * 0.22})`
    ctx.fillRect(rnd() * size, rnd() * size, 1, 1)
  }
  // Ripples: soft sine bands, drawn on a tile that wraps seamlessly.
  ctx.strokeStyle = 'rgba(140,104,70,0.10)'
  ctx.lineWidth = 2
  for (let band = 0; band < 8; band++) {
    ctx.beginPath()
    for (let x = 0; x <= size; x += 4) {
      const y = (band * size) / 8 + 5 * Math.sin((x / size) * Math.PI * 4 + band)
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    }
    ctx.stroke()
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  return texture
}

// Alpha map for the ground disc: opaque inside `fadeStart` (0..1 of the radius), fading to 0 at the rim.
function createRimFadeTexture(fadeStart) {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, '#fff')
  gradient.addColorStop(fadeStart, '#fff')
  gradient.addColorStop(1, '#000')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

function createBlobTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(0,0,0,1)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}
