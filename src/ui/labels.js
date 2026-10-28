import { Scene, Vector3 } from 'three'
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js'
import { config } from '../app/config.js'
import { on } from '../app/state.js'
import { t } from '../i18n/i18n.js'

// Hover label: one HTML element (CSS2D) above the hovered module's bounds. It lives in its own
// tiny scene so the CSS2D pass never walks the model hierarchy. Text is DOM, so Arabic shapes
// correctly and follows dir="rtl".
export function createHoverLabel({ container, camera, registry, loop }) {
  const renderer = new CSS2DRenderer()
  renderer.domElement.className = 'label-layer'
  container.append(renderer.domElement)

  const element = document.createElement('div')
  element.className = 'module-label'
  const label = new CSS2DObject(element)
  label.center.set(0.5, 1) // anchor = bottom-center of the label
  label.visible = false
  const scene = new Scene()
  scene.add(label)

  let id = null
  const anchor = new Vector3()

  function place() {
    const box = registry.get(id).worldBox()
    box.getCenter(anchor)
    anchor.y = box.max.y + config.interaction.labelOffset
    label.position.copy(anchor)
  }

  function render() {
    if (id) element.textContent = t(`modules.${id}.name`)
  }

  on('module:hover', (e) => {
    id = e.id
    label.visible = Boolean(id)
    render()
  })
  on('lang:change', render)

  const resize = () => renderer.setSize(container.clientWidth, container.clientHeight)
  new ResizeObserver(resize).observe(container)
  resize()

  loop.add(() => {
    if (id) place() // modules can move (assembly), so follow every frame while shown
    renderer.render(scene, camera)
  })
}
