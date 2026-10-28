import {
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
} from 'three'
import { config } from '../app/config.js'
import { on } from '../app/state.js'
import { ease } from '../assembly/tween.js'

const SAMPLE_STEP = 0.01 // m between precomputed route samples
const JOIN_TOLERANCE = 0.001 // m; consecutive segments of a route must meet within this

// Tube shader: a dim water line with bright pulses travelling along it (distance-based, so the
// dash spacing is the same on every segment). Output goes through tone mapping + color space.
const vertexShader = /* glsl */ `
  attribute float aDist;
  varying float vDist;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vDist = aDist;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSpacing;
  uniform float uOpacity;
  uniform vec3 uBase;
  uniform vec3 uBright;
  varying float vDist;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float p = fract((vDist - uTime) / uSpacing);
    float pulse = smoothstep(0.0, 0.2, p) * (1.0 - smoothstep(0.35, 0.7, p));
    float rim = 0.55 + 0.45 * abs(dot(vNormal, vView));
    vec3 color = mix(uBase, uBright, pulse) * rim;
    gl_FragColor = vec4(color, uOpacity * (0.6 + 0.4 * pulse));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

// Closed-loop water visual for chapter (d): one tube per path segment with moving pulses, plus
// instanced drops that each travel a whole route (tank → pump → root → back to the tank).
// Lives in the tree group (tree space). Hidden and not updated outside the chapter.
// The pump (`pump:state {on}`) drives the flow: off eases the motion down to a standstill.
export class WaterFlow {
  #flow = 1 // 0..1 current flow, eases toward the pump state
  #pumpOn = true
  #distance = 0 // m travelled by the water so far
  #fade = null
  #matrix = new Matrix4()
  #point = new Vector3()

  constructor({ path, qualityName, tweens, loop }) {
    this.tweens = tweens
    this.group = new Group()
    this.group.name = 'water'
    this.group.visible = false
    this.opacity = 0

    const c = config.water
    this.tubeMaterial = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uSpacing: { value: c.dashSpacing },
        uOpacity: { value: 0 },
        uBase: { value: new Color(c.colors.base) },
        uBright: { value: new Color(c.colors.bright) },
      },
    })

    const curves = {}
    for (const [id, points] of Object.entries(path.segments)) {
      const curve = new CatmullRomCurve3(points.map((p) => new Vector3().fromArray(p)), false, 'centripetal')
      const length = curve.getLength()
      const geometry = new TubeGeometry(curve, Math.max(8, Math.ceil(length * 150)), c.tubeRadius, qualityName === 'low' ? 6 : 8, false)
      const uv = geometry.attributes.uv
      const dist = new Float32Array(uv.count)
      for (let i = 0; i < uv.count; i++) dist[i] = uv.getX(i) * length
      geometry.setAttribute('aDist', new BufferAttribute(dist, 1))
      const tube = new Mesh(geometry, this.tubeMaterial)
      tube.name = `water:${id}`
      tube.renderOrder = 2
      this.group.add(tube)
      curves[id] = curve
    }

    this.routes = Object.entries(path.routes).map(([id, segmentIds]) => this.#sampleRoute(id, segmentIds, curves))

    const count = c.particles[qualityName] ?? c.particles.low
    this.dropMaterial = new MeshBasicMaterial({ color: c.colors.drop, transparent: true, opacity: 0, depthWrite: false })
    this.drops = new InstancedMesh(new IcosahedronGeometry(c.particleRadius, 1), this.dropMaterial, count)
    this.drops.renderOrder = 2
    this.drops.frustumCulled = false // instances move; the base geometry bounds would be wrong
    // Spread drops evenly over the routes, and evenly along each route.
    this.dropSlots = Array.from({ length: count }, (_, i) => {
      const route = this.routes[i % this.routes.length]
      const k = Math.floor(i / this.routes.length)
      const perRoute = Math.ceil(count / this.routes.length)
      return { route, offset: (k / perRoute) * route.length }
    })
    this.group.add(this.drops)

    on('pump:state', ({ on: running }) => (this.#pumpOn = running))
    loop.add((dt) => this.#update(dt))
  }

  get pumpOn() {
    return this.#pumpOn
  }

  get flow() {
    return this.#flow
  }

  // Concatenates a route's segments into evenly spaced samples (positions + cumulative distance).
  #sampleRoute(id, segmentIds, curves) {
    const points = []
    for (const segmentId of segmentIds) {
      const curve = curves[segmentId]
      if (!curve) throw new Error(`waterPath route "${id}": unknown segment "${segmentId}"`)
      const n = Math.max(2, Math.ceil(curve.getLength() / SAMPLE_STEP))
      const spaced = curve.getSpacedPoints(n)
      if (points.length) {
        const gap = points.at(-1).distanceTo(spaced[0])
        if (gap > JOIN_TOLERANCE) console.warn(`[water] route "${id}": "${segmentId}" starts ${(gap * 100).toFixed(1)} cm from the previous segment`)
        spaced.shift()
      }
      points.push(...spaced)
    }
    const positions = new Float32Array(points.length * 3)
    const distances = new Float32Array(points.length)
    points.forEach((p, i) => {
      p.toArray(positions, i * 3)
      if (i) distances[i] = distances[i - 1] + p.distanceTo(points[i - 1])
    })
    return { id, positions, distances, length: distances.at(-1) }
  }

  #pointAt(route, s, target) {
    const { positions, distances } = route
    let lo = 0
    let hi = distances.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (distances[mid] <= s) lo = mid
      else hi = mid
    }
    const t = (s - distances[lo]) / (distances[hi] - distances[lo] || 1)
    return target.set(
      positions[lo * 3] + (positions[hi * 3] - positions[lo * 3]) * t,
      positions[lo * 3 + 1] + (positions[hi * 3 + 1] - positions[lo * 3 + 1]) * t,
      positions[lo * 3 + 2] + (positions[hi * 3 + 2] - positions[lo * 3 + 2]) * t,
    )
  }

  #update(dt) {
    if (!this.group.visible) return
    const target = this.#pumpOn ? 1 : 0
    this.#flow += (target - this.#flow) * Math.min(1, dt * config.water.pumpResponse)
    if (Math.abs(target - this.#flow) < 0.01) this.#flow = target // settle exactly (a real stop)
    this.#distance += dt * this.#flow * config.water.speed
    this.tubeMaterial.uniforms.uTime.value = this.#distance
    this.dropSlots.forEach(({ route, offset }, i) => {
      this.#pointAt(route, (offset + this.#distance) % route.length, this.#point)
      this.drops.setMatrixAt(i, this.#matrix.makeTranslation(this.#point))
    })
    this.drops.instanceMatrix.needsUpdate = true
  }

  #setOpacity(opacity) {
    this.opacity = opacity
    this.tubeMaterial.uniforms.uOpacity.value = opacity
    this.dropMaterial.opacity = opacity
    this.group.visible = opacity > 0
  }

  // visible: fade in/out over config.water.fade (instant: jump).
  setVisible(visible, { instant = false } = {}) {
    this.#fade?.cancel()
    this.#fade = null
    const to = visible ? 1 : 0
    if (instant || this.opacity === to) return this.#setOpacity(to)
    const from = this.opacity
    if (visible) this.group.visible = true
    this.#fade = this.tweens.add({
      duration: config.water.fade,
      ease: ease.inOutCubic,
      onUpdate: (t) => this.#setOpacity(from + (to - from) * t),
      onComplete: () => (this.#fade = null),
    })
  }

  get fading() {
    return this.#fade !== null
  }

  dispose() {
    this.group.traverse((o) => o.isMesh && o.geometry.dispose())
    this.tubeMaterial.dispose()
    this.dropMaterial.dispose()
    this.group.removeFromParent()
  }
}
