import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)

// Loads one GLB. onProgress(ratio 0..1) reports the download; `expectedBytes` (from the manifest)
// stands in when the server sends no Content-Length. Retries `retries` times before throwing.
export async function loadModel(url, { expectedBytes = 0, retries = 0, onProgress } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const gltf = await gltfLoader.loadAsync(url, (e) => {
        const total = e.lengthComputable ? e.total : expectedBytes
        if (total) onProgress?.(Math.min(e.loaded / total, 1))
      })
      return gltf.scene
    } catch (err) {
      if (attempt >= retries) throw err
      onProgress?.(0)
    }
  }
}

// Shrinks every texture of a loaded model by `scale` (e.g. 0.5: 2048² → 1024²) before its first
// upload, to cut GPU memory on phones (iOS Safari kills tabs that use too much). Done with a 2D
// canvas, which works for both ImageBitmap and <img> sources in every browser; no build-time
// image tooling needed. Returns the number of bytes saved (RGBA + mipmaps, estimated).
export function downscaleTextures(root, scale) {
  if (scale >= 1) return 0
  const done = new Set()
  let saved = 0
  root.traverse((obj) => {
    if (!obj.isMesh) return
    for (const material of [obj.material].flat()) {
      for (const texture of Object.values(material)) {
        if (!texture?.isTexture || done.has(texture) || !texture.image?.width) continue
        done.add(texture)
        const { image } = texture
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(image, 0, 0, width, height)
        image.close?.() // free the full-size ImageBitmap
        texture.image = canvas
        texture.needsUpdate = true
        saved += (image.width * image.height - width * height) * 4 * (4 / 3)
      }
    }
  })
  return saved
}
