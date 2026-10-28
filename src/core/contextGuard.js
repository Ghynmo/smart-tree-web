// WebGL context loss (driver reset, GPU switch, too many contexts). three.js keeps the scene and
// re-uploads geometry and textures by itself on restore; GPU-only contents (render targets such
// as the PMREM environment and post-processing buffers) are rebuilt by `onRestored`.
// Emits nothing itself: the App turns these callbacks into `webgl:lost` / `webgl:restored`.
export function guardContext(renderer, { onLost, onRestored }) {
  const canvas = renderer.domElement
  canvas.addEventListener('webglcontextlost', () => onLost())
  canvas.addEventListener('webglcontextrestored', () => onRestored())
}
