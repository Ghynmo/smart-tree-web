import { Box3, Color, Group } from 'three'

const DEG = Math.PI / 180
// Layer for pick proxies: the camera never renders it, the picker's raycaster only tests it.
export const PICK_LAYER = 1

// One Smart Tree module. Hierarchy:
//   root     position/rotation from assembly.json (slot or explode pose), in tree space (meters)
//   content  uniform scale = size.meters / manifest bounds along size.axis
//   model    the loaded GLB, shifted by pivotOffset so its bottom-center sits at the origin
//   proxy    invisible low-poly pick mesh (public/models/proxies.glb), same space as model
export class SmartModule {
  #glow = new Map() // channel → { color, amount }; combined into the materials' emissive
  #baseEmissive = new Map() // material → its own emissive color from the GLB

  constructor(id, def, entry) {
    this.id = id
    this.def = def // live reference into assembly.json data; the debug panel edits it in place
    this.entry = entry
    this.pose = 'slot'
    this.model = null
    this.proxy = null
    this.variant = null // file variant of the current model ('desktop' | 'mobile')

    this.root = new Group()
    this.root.name = id
    this.root.visible = false // shown once its model has loaded
    this.content = new Group()
    this.root.add(this.content)
    this.applyDef()
  }

  url(variant) {
    return this.entry[variant].url
  }

  get scale() {
    const { axis, meters } = this.def.size
    return meters / this.entry.bounds.size[axis]
  }

  applyDef() {
    const position = this.pose === 'explode' ? this.def.explode.position : this.def.slot.position
    this.root.position.fromArray(position)
    const [x, y, z] = this.def.slot.rotation
    this.root.rotation.set(x * DEG, y * DEG, z * DEG)
    this.content.scale.setScalar(this.scale)
  }

  setPose(pose) {
    this.pose = pose
    this.applyDef()
  }

  // Sets (or swaps) the loaded GLB; a previous model is removed and its GPU resources freed.
  setModel(model, variant) {
    const { x, y, z } = this.entry.pivotOffset
    model.position.set(x, y, z)
    this.#disposeModel()
    this.model = model
    this.variant = variant
    this.content.add(model)
    model.traverse((o) => o.isMesh && [o.material].flat().forEach((mat) => this.#baseEmissive.set(mat, mat.emissive.clone())))
    this.#applyGlow()
    this.#applyOpacity()
    this.root.visible = true
  }

  setProxy(mesh) {
    const { x, y, z } = this.entry.pivotOffset
    mesh.position.set(x, y, z)
    mesh.layers.set(PICK_LAYER)
    mesh.userData.moduleId = this.id
    this.proxy = mesh
    this.content.add(mesh)
  }

  // World-space bounds of the visible module (from the proxy, so it works for any variant).
  worldBox(target = new Box3()) {
    this.root.updateWorldMatrix(true, true)
    return target.setFromObject(this.proxy ?? this.content)
  }

  // Emissive highlight by named channel (e.g. 'hover', 'pulse'); the strongest channel wins,
  // so effects never overwrite each other or "bake in" a lit state.
  setGlow(channel, color, amount) {
    if (amount > 0) this.#glow.set(channel, { color: new Color(color), amount })
    else this.#glow.delete(channel)
    this.#applyGlow()
  }

  #applyGlow() {
    let strongest = null
    for (const glow of this.#glow.values()) if (!strongest || glow.amount > strongest.amount) strongest = glow
    for (const [mat, base] of this.#baseEmissive) {
      mat.emissive.copy(base)
      if (strongest) mat.emissive.lerp(strongest.color, strongest.amount)
    }
  }

  // See-through view (x-ray). Below 1 the module renders transparent without depth writes, and
  // first among transparent objects (renderOrder 1), so effects drawn later (water) show through.
  setOpacity(opacity) {
    this.opacity = opacity
    this.#applyOpacity()
  }

  #applyOpacity() {
    const opacity = this.opacity ?? 1
    const seeThrough = opacity < 1
    this.model?.traverse((o) => {
      if (!o.isMesh) return
      o.renderOrder = seeThrough ? 1 : 0
      for (const mat of [o.material].flat()) {
        if (mat.transparent !== seeThrough) mat.needsUpdate = true
        mat.transparent = seeThrough
        mat.depthWrite = !seeThrough
        mat.opacity = opacity
      }
    })
  }

  #disposeModel() {
    if (!this.model) return
    this.model.traverse((obj) => {
      if (!obj.isMesh) return
      obj.geometry.dispose()
      for (const material of [obj.material].flat()) {
        for (const value of Object.values(material)) if (value?.isTexture) value.dispose()
        material.dispose()
      }
    })
    this.#baseEmissive.clear()
    this.model.removeFromParent()
    this.model = null
  }

  dispose() {
    this.#disposeModel()
    if (this.proxy) {
      this.proxy.geometry.dispose()
      this.proxy.material.dispose()
    }
    this.root.removeFromParent()
  }
}
