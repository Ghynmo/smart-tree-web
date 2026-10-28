// Builds invisible low-poly pick proxies: public/models/proxies.glb, one node per module ID.
// Source = the desktop GLB; positions only, baked into the model's scene space (same space as
// manifest bounds), welded and simplified. Raycasting runs only against these (CLAUDE.md, Interaksi).
// Usage: node scripts/build-proxies.mjs

import fs from 'node:fs/promises'
import { Document } from '@gltf-transform/core'
import { dequantize } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'
import { createIO, TRIANGLES } from './lib/gltf.mjs'

const SRC = 'public/models/desktop'
const OUT = 'public/models/proxies.glb'
const MANIFEST = 'src/data/models.manifest.json'
// Target triangles per assembly group; the trunk keeps more so its compartment openings stay open.
const TARGET = { structure: 2500, internal: 300, exterior: 1500, branch: 1200 }
const MAX_ERROR = 0.02 // relative to mesh extent
const WELD = 1e-4 // position-only weld tolerance (model units)

const transform = (m, x, y, z) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
]

// Collects all triangles of a GLB into one welded, world-space position/index pair.
function extract(doc) {
  const positions = []
  const indices = []
  const lookup = new Map()
  const vertex = (p) => {
    const key = p.map((v) => Math.round(v / WELD)).join(',')
    let i = lookup.get(key)
    if (i === undefined) {
      i = positions.length / 3
      lookup.set(key, i)
      positions.push(...p)
    }
    return i
  }
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const matrix = node.getWorldMatrix()
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== TRIANGLES) continue
      const pos = prim.getAttribute('POSITION')
      const idx = prim.getIndices()
      const count = idx ? idx.getCount() : pos.getCount()
      const remap = new Map()
      const el = []
      for (let k = 0; k < count; k++) {
        const v = idx ? idx.getScalar(k) : k
        if (!remap.has(v)) remap.set(v, vertex(transform(matrix, ...pos.getElement(v, el))))
        indices.push(remap.get(v))
      }
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) }
}

// Drops unreferenced vertices after simplification.
function compact(positions, indices) {
  const map = new Map()
  const out = []
  const idx = new Uint32Array(indices.length)
  indices.forEach((v, k) => {
    if (!map.has(v)) {
      map.set(v, out.length / 3)
      out.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2])
    }
    idx[k] = map.get(v)
  })
  return { positions: new Float32Array(out), indices: idx }
}

const io = await createIO()
await MeshoptSimplifier.ready
const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'))
const assembly = JSON.parse(await fs.readFile('src/data/assembly.json', 'utf8'))

const out = new Document()
const buffer = out.createBuffer()
const scene = out.createScene('proxies')
const rows = []

for (const id of Object.keys(manifest.modules)) {
  const doc = await io.read(`${SRC}/${id}.glb`)
  await doc.transform(dequantize())
  const { positions, indices } = extract(doc)
  const target = TARGET[assembly.modules[id].group]
  const [simplified, error] = MeshoptSimplifier.simplify(indices, positions, 3, target * 3, MAX_ERROR, ['Prune'])
  const result = compact(positions, simplified)

  const prim = out
    .createPrimitive()
    .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(result.positions).setBuffer(buffer))
    .setIndices(out.createAccessor().setType('SCALAR').setArray(result.indices).setBuffer(buffer))
  scene.addChild(out.createNode(id).setMesh(out.createMesh(id).addPrimitive(prim)))
  rows.push({ id, source: indices.length / 3, proxy: result.indices.length / 3, error: +error.toFixed(4) })
}

await io.write(OUT, out)
console.table(rows)
const { size } = await fs.stat(OUT)
console.log(`✓ ${OUT}: ${rows.length} proxies, ${rows.reduce((a, r) => a + r.proxy, 0)} triangles, ${(size / 1024).toFixed(0)} KB`)
