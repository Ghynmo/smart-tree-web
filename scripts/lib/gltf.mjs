// Shared glTF helpers for the asset pipeline scripts.

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

export const TRIANGLES = 4

export async function createIO() {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready])
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
}

export function countTriangles(root) {
  let tris = 0
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== TRIANGLES) continue
      tris += (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3
    }
  }
  return tris
}

export const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d
