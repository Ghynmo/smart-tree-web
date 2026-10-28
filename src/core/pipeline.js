import { Vector2 } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'

// Final image: plain render, or render → output (tone mapping + sRGB) → FXAA.
// FXAA replaces MSAA because MSAA is fixed when the WebGL context is created (on an Intel HD 4000
// it cost ~11 ms per frame), while FXAA is a cheap full-screen pass that can be switched off at
// runtime when the quality tier drops.
// The canvas is transparent (sky = CSS layer): both paths keep alpha, the passes carry it through.
export function createPipeline({ renderer, scene, camera }) {
  let composer = null
  const size = new Vector2()

  function setFxaa(enabled) {
    if (enabled === Boolean(composer)) return
    if (enabled) {
      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(new OutputPass())
      composer.addPass(new FXAAPass())
      resize()
    } else {
      composer.dispose()
      composer = null
    }
  }

  // Call after renderer.setSize / setPixelRatio.
  function resize() {
    if (!composer) return
    renderer.getSize(size)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(size.x, size.y)
  }

  // After a WebGL context loss the composer's render targets are gone: build them again.
  function rebuild() {
    if (!composer) return
    setFxaa(false)
    setFxaa(true)
  }

  return {
    render: () => (composer ? composer.render() : renderer.render(scene, camera)),
    setFxaa,
    resize,
    rebuild,
    get fxaa() {
      return Boolean(composer)
    },
  }
}
