import { ACESFilmicToneMapping, WebGLRenderer } from 'three'

// MSAA only when the tier asks for it (quality.aa === 'msaa'); FXAA lives in core/pipeline.js.
// Transparent canvas (alpha): the dusk sky is a CSS layer behind it (src/ui/backdrop.js).
export function createRenderer(quality) {
  const dpr = Math.min(devicePixelRatio, quality.maxDpr)
  const renderer = new WebGLRenderer({
    antialias: quality.aa === 'msaa' && dpr <= 1.5,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(dpr)
  renderer.toneMapping = ACESFilmicToneMapping
  return renderer
}
