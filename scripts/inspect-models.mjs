// Inspect GLB files: bounds, size, pivot, triangles, file size, materials, textures.
// Usage:
//   node scripts/inspect-models.mjs                         (default: models_src → reports/models.report.json)
//   node scripts/inspect-models.mjs <dir> <out.json>        (e.g. public/models/desktop reports/models.desktop.report.json)

import fs from 'node:fs/promises'
import path from 'node:path'
import { getBounds, ImageUtils } from '@gltf-transform/core'
import { TRIANGLES, createIO, round } from './lib/gltf.mjs'

const AXES = ['x', 'y', 'z']

const dir = process.argv[2] ?? 'models_src'
const outFile = process.argv[3] ?? 'reports/models.report.json'

const vec = (a) => Object.fromEntries(AXES.map((k, i) => [k, round(a[i])]))

function countGeometry(root) {
  let triangles = 0
  let vertices = 0
  let primitives = 0
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      primitives++
      const position = prim.getAttribute('POSITION')
      const count = prim.getIndices()?.getCount() ?? position.getCount()
      vertices += position.getCount()
      if (prim.getMode() === TRIANGLES) triangles += count / 3
    }
  }
  return { triangles, vertices, primitives }
}

function describeMaterials(root) {
  return root.listMaterials().map((m) => ({
    name: m.getName(),
    alphaMode: m.getAlphaMode(),
    alphaCutoff: m.getAlphaMode() === 'MASK' ? m.getAlphaCutoff() : undefined,
    doubleSided: m.getDoubleSided(),
    baseColorFactor: m.getBaseColorFactor().map((v) => round(v, 3)),
    metallic: round(m.getMetallicFactor(), 3),
    roughness: round(m.getRoughnessFactor(), 3),
    maps: {
      baseColor: !!m.getBaseColorTexture(),
      metallicRoughness: !!m.getMetallicRoughnessTexture(),
      normal: !!m.getNormalTexture(),
      emissive: !!m.getEmissiveTexture(),
      occlusion: !!m.getOcclusionTexture(),
    },
  }))
}

function describeTextures(root) {
  return root.listTextures().map((t) => {
    const size = ImageUtils.getSize(t.getImage(), t.getMimeType())
    return {
      name: t.getName(),
      mimeType: t.getMimeType(),
      width: size?.[0],
      height: size?.[1],
      kb: Math.round(t.getImage().byteLength / 1024),
    }
  })
}

function describeNodes(root) {
  return root.listNodes().map((n) => ({
    name: n.getName(),
    mesh: !!n.getMesh(),
    translation: n.getTranslation().map((v) => round(v)),
    rotation: n.getRotation().map((v) => round(v)),
    scale: n.getScale().map((v) => round(v)),
  }))
}

async function inspect(io, file) {
  const stat = await fs.stat(file)
  const doc = await io.read(file)
  const root = doc.getRoot()
  const scene = root.getDefaultScene() ?? root.listScenes()[0]

  const { min, max } = getBounds(scene)
  const size = min.map((v, i) => max[i] - v)
  const center = min.map((v, i) => (v + max[i]) / 2)
  // Origin (pivot) expressed relative to bounds: 0 = min side, 0.5 = center, 1 = max side.
  const pivotRel = min.map((v, i) => (size[i] ? (0 - v) / size[i] : 0))
  const longest = AXES[size.indexOf(Math.max(...size))]

  return {
    id: path.basename(file, '.glb'),
    file: path.basename(file),
    bytes: stat.size,
    mb: round(stat.size / 1048576, 2),
    extensionsUsed: root.listExtensionsUsed().map((e) => e.extensionName),
    ...countGeometry(root),
    bounds: { min: vec(min), max: vec(max), size: vec(size), center: vec(center) },
    pivotRel: vec(pivotRel),
    longestAxis: longest,
    nodes: describeNodes(root),
    materials: describeMaterials(root),
    textures: describeTextures(root),
  }
}

function printTable(models) {
  const head = ['model', 'MB', 'tris', 'size x×y×z', 'pivot (rel) x,y,z', 'long', 'alpha', 'tex']
  const rows = models.map((m) => [
    m.id,
    m.mb.toFixed(1),
    m.triangles.toLocaleString('en-US'),
    AXES.map((k) => m.bounds.size[k].toFixed(3)).join('×'),
    AXES.map((k) => m.pivotRel[k].toFixed(2)).join(','),
    m.longestAxis,
    [...new Set(m.materials.map((x) => x.alphaMode))].join('/'),
    [...new Set(m.textures.map((t) => `${t.width}²`))].join('/'),
  ])
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)))
  const line = (r) => r.map((c, i) => c.padEnd(widths[i])).join('  ')
  console.log(line(head))
  console.log(widths.map((w) => '-'.repeat(w)).join('  '))
  rows.forEach((r) => console.log(line(r)))
}

const io = await createIO()
const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.glb')).sort()
if (!files.length) {
  console.error(`No .glb files in ${dir}`)
  process.exit(1)
}

const models = []
for (const f of files) models.push(await inspect(io, path.join(dir, f)))

const totals = {
  files: models.length,
  mb: round(models.reduce((s, m) => s + m.bytes, 0) / 1048576, 2),
  triangles: models.reduce((s, m) => s + m.triangles, 0),
}

printTable(models)
console.log(`\nTotal: ${totals.files} files, ${totals.mb} MB, ${totals.triangles.toLocaleString('en-US')} triangles`)

await fs.mkdir(path.dirname(outFile), { recursive: true })
await fs.writeFile(
  outFile,
  JSON.stringify({ generatedAt: new Date().toISOString(), source: dir, totals, models }, null, 2) + '\n',
)
console.log(`Report: ${outFile}`)
