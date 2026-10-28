// Dev-only assembly tuning panel, loaded dynamically with ?debug=1. Exempt from the i18n rule.
// Edits mutate the assembly data in place; "Save" writes src/data/assembly.json through the
// dev-server endpoint in vite.config.js, "Download" is the fallback.

import GUI from 'lil-gui'
import { AxesHelper, Box3, Box3Helper, Color, Plane, Vector3 } from 'three'
import { config } from '../app/config.js'
import { formatJson } from './formatJson.js'

const SAVE_ENDPOINT = '/__debug/assembly'
const VIEWS = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  top: [0, 1, 0.001],
}

// `app` is the object returned by startApp (also exposed as window.__smartTree with ?debug=1).
export function createDebugPanel(app) {
  const { registry, assembly, renderer, scene, camera, controls } = app
  const gui = new GUI({ title: 'Smart Tree · debug', width: 320 })
  gui.onChange(() => app.loop.invalidate()) // the loop renders on demand
  const box = new Box3()
  const helpers = new Map()
  const clipPlane = new Plane(new Vector3(0, 0, -1), 0)
  renderer.localClippingEnabled = true

  const state = {
    pose: 'slot',
    freeCamera: true,
    bounds: false,
    axes: false,
    trunkOpacity: 1,
    clip: false,
    clipZ: 0,
    status: '',
  }

  const forEachMaterial = (object, fn) =>
    object.traverse((o) => o.isMesh && [o.material].flat().forEach((mat) => fn(mat)))

  function refreshHelpers() {
    for (const m of registry.list()) {
      let helper = helpers.get(m.id)
      if (!helper) {
        helper = new Box3Helper(new Box3(), new Color(m.def.group === 'internal' ? 0xffcc00 : 0x00ccff))
        helpers.set(m.id, helper)
        scene.add(helper)
      }
      helper.box.setFromObject(m.root)
      helper.visible = state.bounds && m.root.visible
    }
  }

  function dimensions(m) {
    box.setFromObject(m.root)
    const s = box.getSize(new Vector3())
    return `${s.x.toFixed(2)} × ${s.y.toFixed(2)} × ${s.z.toFixed(2)} m  ·  y ${box.min.y.toFixed(2)}→${box.max.y.toFixed(2)}`
  }

  function applyCameraLimits() {
    Object.assign(controls, state.freeCamera
      ? { enablePan: true, minDistance: 0.1, maxDistance: 30, minPolarAngle: 0, maxPolarAngle: Math.PI }
      : { enablePan: false, ...config.controls })
  }

  function applyTrunkOpacity() {
    forEachMaterial(registry.get('trunk_base').root, (mat) => {
      mat.transparent = state.trunkOpacity < 1
      mat.opacity = state.trunkOpacity
      mat.depthWrite = state.trunkOpacity === 1
      mat.needsUpdate = true
    })
  }

  function applyClip() {
    clipPlane.constant = state.clipZ
    for (const m of registry.list()) {
      forEachMaterial(m.root, (mat) => {
        mat.clippingPlanes = state.clip ? [clipPlane] : null
        mat.needsUpdate = true
      })
    }
  }

  function setView(dir) {
    const distance = camera.position.distanceTo(controls.target)
    camera.position.copy(controls.target).addScaledVector(new Vector3(...dir).normalize(), distance)
    controls.update()
  }

  function serialize() {
    return formatJson(assembly)
  }

  async function save() {
    try {
      const res = await fetch(SAVE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: serialize() })
      if (!res.ok) throw new Error(await res.text())
      state.status = `saved ${new Date().toLocaleTimeString()}`
    } catch (err) {
      state.status = `save failed: ${err.message}`
    }
    statusCtrl.updateDisplay()
  }

  function download() {
    const url = URL.createObjectURL(new Blob([serialize()], { type: 'application/json' }))
    Object.assign(document.createElement('a'), { href: url, download: 'assembly.json' }).click()
    URL.revokeObjectURL(url)
  }

  // --- global controls
  const view = gui.addFolder('View')
  view.add(state, 'pose', ['slot', 'explode']).name('pose (instant)').onChange((pose) => {
    app.assemblyController.go(pose === 'explode' ? 'exploded' : 'assembled', { instant: true })
    refreshAll()
  })
  view.add({ animate: () => app.assemblyController.toggle() }, 'animate').name('explode / assemble (animated)')
  view.add(state, 'freeCamera').name('free camera').onChange(applyCameraLimits)
  for (const [name, dir] of Object.entries(VIEWS)) view.add({ [name]: () => setView(dir) }, name)
  view.add(state, 'bounds').name('show bounds').onChange(refreshHelpers)
  const axes = new AxesHelper(0.5)
  axes.visible = false
  scene.add(axes)
  view.add(state, 'axes').name('show axes').onChange((v) => (axes.visible = v))
  view.add(state, 'trunkOpacity', 0.1, 1, 0.05).name('trunk opacity').onChange(applyTrunkOpacity)
  view.add(state, 'clip').name('section cut (z)').onChange(applyClip)
  view.add(state, 'clipZ', -1, 1, 0.005).name('cut z').onChange(applyClip)

  const perf = gui.addFolder('Quality')
  const perfState = { tier: '', fps: '' }
  const tierCtrl = perf.add(perfState, 'tier').disable()
  const fpsCtrl = perf.add(perfState, 'fps').name('fps (watcher)').disable()
  perf.add({ downgrade: () => app.downgrade({ manual: true }) }, 'downgrade').name('downgrade (one step)')
  setInterval(() => {
    const q = app.quality
    perfState.tier = `${q.name}${q.forced ? ' (forced)' : ''} · dpr ${renderer.getPixelRatio().toFixed(2)} · ${registry.variant} · ${q.aa}/${q.lighting}`
    perfState.fps = app.fps == null ? '—' : app.fps.toFixed(1)
    tierCtrl.updateDisplay()
    fpsCtrl.updateDisplay()
  }, 500)

  const file = gui.addFolder('File')
  file.add({ save }, 'save').name('Save → src/data/assembly.json')
  file.add({ download }, 'download').name('Download assembly.json')
  const statusCtrl = file.add(state, 'status').name('status').disable()

  // --- per-module controls
  const dimsCtrls = []
  const modulesFolder = gui.addFolder('Modules')
  for (const m of registry.list()) {
    const f = modulesFolder.addFolder(m.id).close()
    const dims = { value: '' }
    const onChange = () => {
      m.applyDef()
      refreshAll()
    }
    f.add(m.def.size, 'meters', 0.02, 3, 0.005).name(`size (${m.def.size.axis}) m`).onChange(onChange)
    const slot = f.addFolder('slot').close()
    ;['x', 'y', 'z'].forEach((k, i) => slot.add(m.def.slot.position, i, -2, 3, 0.005).name(`pos ${k}`).onChange(onChange))
    ;['x', 'y', 'z'].forEach((k, i) => slot.add(m.def.slot.rotation, i, -180, 180, 1).name(`rot ${k}°`).onChange(onChange))
    const explode = f.addFolder('explode').close()
    ;['x', 'y', 'z'].forEach((k, i) => explode.add(m.def.explode.position, i, -3, 4, 0.005).name(`pos ${k}`).onChange(onChange))
    f.add(m.root, 'visible').onChange(refreshHelpers)
    dimsCtrls.push({ m, dims, ctrl: f.add(dims, 'value').name('real size').disable() })
  }

  function refreshAll() {
    refreshHelpers()
    for (const { m, dims, ctrl } of dimsCtrls) {
      dims.value = dimensions(m)
      ctrl.updateDisplay()
    }
  }

  applyCameraLimits()
  refreshAll()
  return gui
}
