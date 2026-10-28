// Decimate and compress source GLBs into desktop and mobile variants.
// Input:  models_src/*.glb (never modified)
// Output: public/models/{desktop,mobile}/<moduleId>.glb
// Usage:  node scripts/optimize-models.mjs [moduleId ...]   (no args = all modules)

import fs from 'node:fs/promises'
import path from 'node:path'
import { compactPrimitive, dedup, dequantize, meshopt, prune, weld } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import { TRIANGLES, countTriangles, createIO } from './lib/gltf.mjs'

const SRC_DIR = 'models_src'
const OUT_DIR = 'public/models'

// Target triangle counts per variant. `error` caps geometric deviation
// (fraction of mesh radius) so simplify never collapses a silhouette to hit a count.
// `level` is the meshopt compression level ('high' adds attribute filters for smaller files).
const VARIANTS = {
  desktop: { error: 0.02, level: 'high' },
  mobile: { error: 0.04, level: 'high' },
}

// The four new_*_opt.glb sources (owner update, 2026-10-28) are already low-poly (16–28k triangles,
// no normal map): below the desktop target they pass through unsimplified; mobile is capped at 20k.
// The previous sources (green_tank.glb, nutrient_tank.glb, opt_battery.glb, solar_panel.glb) stay
// in models_src/ untouched.
const MODULES = {
  trunk_base:        { src: 'trunk_base.glb',            desktop: 60_000,  mobile: 30_000 },
  green_tank:        { src: 'new_green_tank_opt.glb',    desktop: 40_000,  mobile: 20_000 },
  distribution_pipe: { src: 'distribution_pipe.glb',     desktop: 40_000,  mobile: 20_000 },
  nutrient_tank:     { src: 'new_nutrient_tank_opt.glb', desktop: 50_000,  mobile: 20_000 },
  battery:           { src: 'new_battery_opt.glb',       desktop: 40_000,  mobile: 20_000 },
  tree_crown:        { src: 'tree_crown.glb',            desktop: 150_000, mobile: 70_000 },
  solar_panel:       { src: 'new_solar_panel_opt.glb',   desktop: 40_000,  mobile: 20_000 },
  branch_apple:      { src: 'branch_apple.glb',          desktop: 100_000, mobile: 40_000 },
  branch_mango:      { src: 'branch_mango.glb',          desktop: 100_000, mobile: 40_000 },
  branch_grape:      { src: 'branch_grape.glb',          desktop: 100_000, mobile: 40_000 },
  branch_orange:     { src: 'branch_orange.glb',         desktop: 100_000, mobile: 40_000 },
}

// Attribute-aware simplification weights: TEXCOORD_0 (u, v), NORMAL (x, y, z).
// UV weight protects texture seams; normal weight keeps shading on curved parts.
const ATTRIBUTE_WEIGHTS = { TEXCOORD_0: 0.5, NORMAL: 0.1 }
const ATTRIBUTE_SIZES = { TEXCOORD_0: 2, NORMAL: 3 }

// Meshy exports split vertices on nearly every UV seam (tree_crown: 1.66M vertices for 1.23M
// triangles), which stalls @gltf-transform/functions simplify() far above target. Calling
// meshoptimizer directly with Permissive lets edges collapse across seams, while the
// attribute weights keep those collapses from smearing UVs.
function simplifyPermissive({ ratio, error }) {
  return (doc) => {
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMode() !== TRIANGLES || !prim.getIndices()) continue
        const positions = new Float32Array(prim.getAttribute('POSITION').getArray())
        const indices = new Uint32Array(prim.getIndices().getArray())
        const vertexCount = positions.length / 3

        const semantics = Object.keys(ATTRIBUTE_WEIGHTS).filter((k) => prim.getAttribute(k))
        const stride = semantics.reduce((n, k) => n + ATTRIBUTE_SIZES[k], 0)
        const weights = semantics.flatMap((k) => Array(ATTRIBUTE_SIZES[k]).fill(ATTRIBUTE_WEIGHTS[k]))
        const attributes = new Float32Array(vertexCount * stride)
        let offset = 0
        for (const k of semantics) {
          const src = prim.getAttribute(k).getArray()
          const size = ATTRIBUTE_SIZES[k]
          for (let v = 0; v < vertexCount; v++) {
            for (let c = 0; c < size; c++) attributes[v * stride + offset + c] = src[v * size + c]
          }
          offset += size
        }

        const targetIndexCount = Math.floor((indices.length / 3) * ratio) * 3
        const [dst] = MeshoptSimplifier.simplifyWithAttributes(
          indices, positions, 3, attributes, stride, weights, null, targetIndexCount, error, ['Permissive'],
        )
        prim.getIndices().setArray(dst)
        compactPrimitive(prim)
      }
    }
  }
}

async function optimize(io, id, variant) {
  const cfg = MODULES[id]
  const doc = await io.read(path.join(SRC_DIR, cfg.src))
  const srcTris = countTriangles(doc.getRoot())
  const target = cfg[variant]
  const ratio = Math.min(1, target / srcTris)

  await doc.transform(
    dedup(),
    dequantize(),
    weld(),
    simplifyPermissive({ ratio, error: VARIANTS[variant].error }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: VARIANTS[variant].level }),
  )

  const outFile = path.join(OUT_DIR, variant, `${id}.glb`)
  await io.write(outFile, doc)
  const { size } = await fs.stat(outFile)
  return { id, variant, srcTris, target, tris: countTriangles(doc.getRoot()), bytes: size }
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MODULES)
const unknown = ids.filter((id) => !MODULES[id])
if (unknown.length) {
  console.error(`Unknown module id: ${unknown.join(', ')}`)
  process.exit(1)
}

await MeshoptSimplifier.ready
const io = await createIO()
const results = []
for (const variant of Object.keys(VARIANTS)) {
  await fs.mkdir(path.join(OUT_DIR, variant), { recursive: true })
  for (const id of ids) {
    const r = await optimize(io, id, variant)
    results.push(r)
    const hit = r.tris <= r.target * 1.05 ? 'ok' : 'ABOVE TARGET (error cap reached)'
    console.log(
      `${variant.padEnd(7)} ${id.padEnd(17)} ${r.srcTris.toLocaleString('en-US').padStart(9)} → ` +
        `${r.tris.toLocaleString('en-US').padStart(7)} tris  ${(r.bytes / 1048576).toFixed(2).padStart(5)} MB  ${hit}`,
    )
  }
}

for (const variant of Object.keys(VARIANTS)) {
  const rows = results.filter((r) => r.variant === variant)
  const mb = rows.reduce((s, r) => s + r.bytes, 0) / 1048576
  const tris = rows.reduce((s, r) => s + r.tris, 0)
  console.log(`\n${variant}: ${mb.toFixed(2)} MB, ${tris.toLocaleString('en-US')} triangles`)
}
