// Dev-only: writes the hand-built illustration assets to public/art/ (deterministic, seeded).
//   hero.svg   intro backdrop: the plain of Arafah at dusk, granite ranges, Jabal Rahmah, and rows of
//              young trees that grow denser toward one side (barren sand → greened plain).
//              Transparent sky: the dusk gradient comes from the CSS backdrop (src/ui/backdrop.js).
//   girih.svg  seamless 8-point star (khatam) lattice tile for panels and the loading screen.
// usage: node tools/build-art.mjs
// Generated raster art (Codex image generation, see art_src/prompts.md) can replace hero.svg later.
import fs from 'node:fs'

const OUT = new URL('../public/art/', import.meta.url)
fs.mkdirSync(OUT, { recursive: true })

// Small seeded PRNG (mulberry32) so the art is identical on every run.
function prng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const f = (n) => Number(n.toFixed(1))

const W = 1600
const H = 900
const HORIZON = 668

// Mountain silhouette: layered sines + jitter along the width, closed down to `bottom`.
function ridge({ base, amp, seed, step = 16, bottom = HORIZON + 6, peaks = [] }) {
  const rnd = prng(seed)
  const phase = [rnd() * 6, rnd() * 6, rnd() * 6]
  const pts = []
  for (let x = -20; x <= W + 20; x += step) {
    let y = base
    y -= amp * (0.55 * Math.sin(x / 210 + phase[0]) + 0.3 * Math.sin(x / 97 + phase[1]) + 0.15 * Math.sin(x / 41 + phase[2]))
    y -= amp * 0.12 * (rnd() - 0.5)
    for (const p of peaks) y -= p.h * Math.exp(-(((x - p.x) / p.w) ** 2))
    pts.push(`${f(x)},${f(y)}`)
  }
  return `M-20,${bottom} L${pts.join(' L')} L${W + 20},${bottom} Z`
}

// Linear blend of two #rrggbb colors (atmospheric perspective: far trees sink into the haze).
function mix(a, b, t) {
  const c = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const [x, y] = [c(a), c(b)]
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}

// One young tree (neem-like irregular canopy), base at (x, y), scale s, haze 0..1.
// Backlit by the setting sun: dark olive body, a thin warm rim on the side facing the sun.
function tree(x, y, s, rnd, sunX, haze) {
  const h = 66 * s * (0.85 + rnd() * 0.3)
  const r = 15 * s * (0.85 + rnd() * 0.3)
  const lean = (rnd() - 0.5) * 4 * s
  const toSun = Math.sign(sunX - x) || 1
  const cx = x + lean
  const cy = y - h + r * 0.9
  const body = mix(rnd() < 0.5 ? '#2f4a2c' : '#3a5733', '#6a4a44', haze)
  const rim = mix('#d8b26a', '#8a6650', haze)
  const blobs = []
  const n = 5 + Math.floor(rnd() * 3)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.6
    const d = r * (0.45 + rnd() * 0.4)
    blobs.push([cx + Math.cos(a) * d * 1.25, cy + Math.sin(a) * d * 0.8, r * (0.55 + rnd() * 0.3)])
  }
  blobs.push([cx, cy, r * 0.8])
  const sw = Math.max(0.6, 2.2 * s)
  return [
    `<ellipse cx="${f(x - toSun * 12 * s)}" cy="${f(y)}" rx="${f(r * 1.7)}" ry="${f(r * 0.28)}" fill="#2a1b1c" opacity="${f(0.4 * (1 - haze))}"/>`,
    `<path d="M${f(x)},${f(y)} Q${f(x + lean * 0.3)},${f(y - h * 0.5)} ${f(cx)},${f(cy)}" stroke="${mix('#3a2721', '#6a4a44', haze)}" stroke-width="${f(sw)}" fill="none" stroke-linecap="round"/>`,
    ...blobs.map(([bx, by, br]) => `<circle cx="${f(bx + toSun * br * 0.12)}" cy="${f(by - br * 0.08)}" r="${f(br)}" fill="${rim}" opacity="${f(0.5 * (1 - haze))}"/>`),
    ...blobs.map(([bx, by, br]) => `<circle cx="${f(bx)}" cy="${f(by)}" r="${f(br)}" fill="${body}"/>`),
  ].join('')
}

function hero() {
  const rnd = prng(7)
  const sunX = 760
  // Rows of planted trees: perspective depth z (1 = nearest). Density rises toward inline-end,
  // so the plain reads as "being greened" from right to left.
  const trees = []
  for (let row = 0; row < 9; row++) {
    const z = 1 + row * 0.9
    const y = HORIZON + 210 / z
    const s = 1.25 / z
    const spacing = 120 / z
    for (let x = -40 + (row % 2) * spacing * 0.5; x < W + 40; x += spacing * (0.85 + rnd() * 0.3)) {
      const greened = Math.min(Math.max(x / W, 0), 1) ** 1.6 // 0 at the left edge, 1 at the right
      if (rnd() > 0.12 + greened * 0.88) continue
      trees.push({ x: x + (rnd() - 0.5) * spacing * 0.3, y, s: s * (0.75 + greened * 0.4), haze: Math.min(row / 9, 0.85) })
    }
  }
  trees.sort((a, b) => a.y - b.y) // far rows first
  const grove = trees.map((t) => tree(t.x, t.y, t.s, rnd, sunX, t.haze)).join('')

  // Jabal Rahmah: a lone rounded granite hill on the plain with its white pillar on the summit.
  const JR = { x: 1190, base: HORIZON + 4, top: 596, w: 170 }
  const hill = `M${JR.x - JR.w * 1.6},${JR.base} C${JR.x - JR.w},${JR.base - 4} ${JR.x - JR.w * 0.55},${JR.top} ${JR.x},${JR.top}
    C${JR.x + JR.w * 0.5},${JR.top} ${JR.x + JR.w},${JR.base - 6} ${JR.x + JR.w * 1.7},${JR.base} Z`
  const ledges = []
  for (let i = 0; i < 6; i++) {
    const t = rnd()
    const y = JR.top + 10 + t * (JR.base - JR.top - 16)
    const half = JR.w * (0.25 + 0.95 * ((y - JR.top) / (JR.base - JR.top)))
    const x = JR.x + (rnd() - 0.5) * half
    ledges.push(`<path d="M${f(x - 14 - rnd() * 20)},${f(y)} q${f(16 + rnd() * 10)},-${f(2 + rnd() * 3)} ${f(30 + rnd() * 24)},${f(rnd() * 2)}" stroke="#2c1e27" stroke-opacity="0.22" stroke-width="1.2" fill="none" stroke-linecap="round"/>`)
  }
  const rocks = [`<path d="${hill}" fill="url(#rahmah)"/>`, ...ledges]
  const pillar = `<rect x="${JR.x - 3.5}" y="${JR.top - 30}" width="7" height="32" rx="1.5" fill="#efe3cc" opacity="0.9"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice">
<defs>
  <radialGradient id="halo" cx="${sunX}" cy="${HORIZON - 20}" r="620" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#f1c27d" stop-opacity="0.55"/>
    <stop offset="0.25" stop-color="#c9814f" stop-opacity="0.28"/>
    <stop offset="1" stop-color="#2a1f2e" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="far" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#4a3346"/><stop offset="1" stop-color="#2c2132"/>
  </linearGradient>
  <linearGradient id="near" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#5a3a3e"/><stop offset="1" stop-color="#352430"/>
  </linearGradient>
  <linearGradient id="rahmah" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#6a4446"/><stop offset="1" stop-color="#3e2a33"/>
  </linearGradient>
  <linearGradient id="plain" x1="0" y1="${HORIZON}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#7a5040"/><stop offset="0.35" stop-color="#8f6249"/><stop offset="1" stop-color="#6a4836"/>
  </linearGradient>
  <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#e2a86c" stop-opacity="0"/><stop offset="0.5" stop-color="#e2a86c" stop-opacity="0.35"/><stop offset="1" stop-color="#e2a86c" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="dune" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#5c3d31"/><stop offset="1" stop-color="#2e2027"/>
  </linearGradient>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3"/>
    <feColorMatrix values="0 0 0 0 0.95  0 0 0 0 0.85  0 0 0 0 0.7  0 0 0 0.9 0"/>
  </filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#halo)"/>
<circle cx="${sunX}" cy="${HORIZON - 34}" r="64" fill="#f3cf8e" opacity="0.92"/>
<path d="${ridge({ base: 618, amp: 46, seed: 11, peaks: [{ x: 300, w: 160, h: 40 }, { x: 1450, w: 200, h: 30 }] })}" fill="url(#far)"/>
<path d="${ridge({ base: 650, amp: 18, seed: 23, step: 12 })}" fill="url(#near)"/>
${rocks.join('')}
${pillar}
<rect x="0" y="${HORIZON - 30}" width="${W}" height="60" fill="url(#haze)"/>
<path d="M-20,${HORIZON} C400,${HORIZON - 4} 1200,${HORIZON + 4} ${W + 20},${HORIZON - 2} L${W + 20},${H} L-20,${H} Z" fill="url(#plain)"/>
<path d="M-20,${HORIZON + 2} C500,${HORIZON + 8} 1100,${HORIZON - 2} ${W + 20},${HORIZON + 4}" stroke="#f1c27d" stroke-opacity="0.35" stroke-width="2" fill="none"/>
<ellipse cx="${W * 0.82}" cy="${HORIZON + 120}" rx="${W * 0.42}" ry="90" fill="#5f8f4e" opacity="0.12"/>
${grove}
<path d="M-20,${H - 34} C300,${H - 70} 640,${H - 40} 900,${H - 52} C1150,${H - 64} 1400,${H - 30} ${W + 20},${H - 46} L${W + 20},${H} L-20,${H} Z" fill="url(#dune)"/>
<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.07"/>
</svg>
`
}

// Seamless khatam lattice: 8-point stars at the tile center and corners, joined along the axes
// and diagonals. Tile repeats at 120 px; stroke color is gold, opacity set by the CSS layer.
function girih() {
  const S = 120
  const R = 22
  const star = (cx, cy) => {
    const pts = []
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8 - Math.PI / 2
      const r = i % 2 ? R * 0.62 : R
      pts.push(`${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`)
    }
    return `<polygon points="${pts.join(' ')}"/>`
  }
  const c = S / 2
  const d = R * Math.SQRT1_2
  const lines = [
    [c, c - R, c, 0], [c, c + R, c, S], [c - R, c, 0, c], [c + R, c, S, c],
    [c - d, c - d, d, d], [c + d, c - d, S - d, d], [c - d, c + d, d, S - d], [c + d, c + d, S - d, S - d],
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
<g fill="none" stroke="#c9a45c" stroke-width="1">
${star(c, c)}${star(0, 0)}${star(S, 0)}${star(0, S)}${star(S, S)}
${lines.map(([x1, y1, x2, y2]) => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`).join('')}
<rect x="${c - 6}" y="${c - 6}" width="12" height="12" transform="rotate(45 ${c} ${c})"/>
</g>
</svg>
`
}

for (const [name, svg] of [['hero.svg', hero()], ['girih.svg', girih()]]) {
  fs.writeFileSync(new URL(name, OUT), svg)
  console.log(`public/art/${name}  ${(svg.length / 1024).toFixed(1)} KB`)
}
