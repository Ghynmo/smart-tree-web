// Build src/data/models.manifest.json from the optimized GLBs.
// The manifest is GENERATED (safe to overwrite). src/data/assembly.json is MANUAL and is only
// validated here, never written.
// Usage: node scripts/build-manifest.mjs

import fs from 'node:fs/promises'
import path from 'node:path'
import { getBounds } from '@gltf-transform/core'
import { countTriangles, createIO, round } from './lib/gltf.mjs'

const MODELS_DIR = 'public/models'
const VARIANTS = ['desktop', 'mobile']
const MANIFEST_FILE = 'src/data/models.manifest.json'
const ASSEMBLY_FILE = 'src/data/assembly.json'
const AXES = ['x', 'y', 'z']

const vec = (a) => Object.fromEntries(AXES.map((k, i) => [k, round(a[i])]))

async function readVariant(io, variant, id) {
  const file = path.join(MODELS_DIR, variant, `${id}.glb`)
  const { size: bytes } = await fs.stat(file)
  const root = (await io.read(file)).getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  return { url: `/models/${variant}/${id}.glb`, bytes, tris: countTriangles(root), bounds: getBounds(scene) }
}

async function validateAssembly(ids) {
  let assembly
  try {
    assembly = JSON.parse(await fs.readFile(ASSEMBLY_FILE, 'utf8'))
  } catch (err) {
    console.warn(`! ${ASSEMBLY_FILE}: ${err.code === 'ENOENT' ? 'missing' : err.message}`)
    return
  }
  const listed = Object.keys(assembly.modules ?? {})
  const missing = ids.filter((id) => !listed.includes(id))
  const unknown = listed.filter((id) => !ids.includes(id))
  const badAxis = listed.filter((id) => !AXES.includes(assembly.modules[id].size?.axis))
  if (missing.length) console.warn(`! assembly.json missing modules: ${missing.join(', ')}`)
  if (unknown.length) console.warn(`! assembly.json has unknown modules: ${unknown.join(', ')}`)
  if (badAxis.length) console.warn(`! assembly.json invalid size.axis: ${badAxis.join(', ')}`)
  if (!missing.length && !unknown.length && !badAxis.length) console.log(`✓ ${ASSEMBLY_FILE} covers all ${ids.length} modules`)
}

const io = await createIO()
const ids = (await fs.readdir(path.join(MODELS_DIR, 'desktop')))
  .filter((f) => f.endsWith('.glb'))
  .map((f) => path.basename(f, '.glb'))
  .sort()

const modules = {}
for (const id of ids) {
  const variants = {}
  for (const v of VARIANTS) variants[v] = await readVariant(io, v, id)

  // Desktop bounds are the reference for both variants, so a module has identical scale and
  // placement on every quality tier (mobile bounds differ by ~1% after decimation).
  const { min, max } = variants.desktop.bounds
  const size = min.map((v, i) => max[i] - v)
  const center = min.map((v, i) => (v + max[i]) / 2)

  modules[id] = {
    ...Object.fromEntries(VARIANTS.map((v) => [v, { url: variants[v].url, bytes: variants[v].bytes, tris: variants[v].tris }])),
    bounds: { min: vec(min), max: vec(max), size: vec(size) },
    // Translation that moves the pivot to bottom-center of the bounds (applied before scaling).
    pivotOffset: vec([-center[0], -min[1], -center[2]]),
  }
}

const manifest = {
  _meta: {
    generatedBy: 'scripts/build-manifest.mjs',
    note: 'GENERATED — do not edit by hand. Rerun `npm run models:manifest`.',
    units: 'raw model units (Meshy-normalized, longest axis ≈ 1.9); real-world size comes from assembly.json',
  },
  modules,
}

await fs.mkdir(path.dirname(MANIFEST_FILE), { recursive: true })
await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n')
console.log(`✓ ${MANIFEST_FILE}: ${ids.length} modules`)
await validateAssembly(ids)
