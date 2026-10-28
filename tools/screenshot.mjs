// Dev-only: headless Chrome screenshots via DevTools Protocol, after all Smart Tree models load.
// Requires a running dev server and the ?debug=1 URL (it waits on window.__smartTree).
// usage: node tools/screenshot.mjs <url> <outDir> <name>[=<js run before the shot>] ...
// e.g.   node tools/screenshot.mjs "http://localhost:5173/?debug=1" shots \
//          "front=window.__smartTree.camera.position.set(0, 1, 4.2)"
// Chrome path can be overridden with CHROME_PATH. Options (env):
//   THROTTLE=fast4g|slow4g  DevTools network presets, cache disabled
//   WAIT=all (default, every model) | core (loading screen gone) | none
//   TRACE=1                 print a loading timeline (loading-screen %, background pill, models loaded)
//   QUALITY_TRACE=1         also print quality tier / fps samples
//   UNCAPPED=1              no vsync / frame-rate limit (measure real frame cost; headless caps at ~50 FPS)
//   VIEWPORT=390x844        phone-sized viewport (mobile emulation, DPR 2, touch / coarse pointer)
//   SIZE=1600x1000          desktop viewport size (default 1280x800)
//   FORMAT=webp             image format of the shots (png default; webp at quality 85)
//   NOWEBGL=1               start Chrome with WebGL disabled (tests the fallback poster)
//   REDUCED=1               emulate prefers-reduced-motion: reduce
//   REQUESTS=1              print the requested hosts (offline check: only the local server allowed)
//   BLOCK=a.glb,b.glb       block request URLs matching these patterns (tests load errors)
//   GL=gpu                  use the real GPU (D3D11) instead of SwiftShader; CPU rendering starves the
//                           main thread, which slows downloads and makes FPS meaningless
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const [url, outDir, ...shots] = process.argv.slice(2)
const PORT = 9333
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const profile = path.join(os.tmpdir(), 'smart-tree-screenshot-profile')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// Same numbers as Chrome DevTools' throttling presets (bytes/s, ms).
const NETWORK = {
  fast4g: { downloadThroughput: (9e6 / 8) * 0.9, uploadThroughput: (1.5e6 / 8) * 0.9, latency: 60 * 2.75 },
  slow4g: { downloadThroughput: (1.6e6 / 8) * 0.9, uploadThroughput: (750e3 / 8) * 0.9, latency: 150 * 3.75 },
}
const { THROTTLE, WAIT = 'all', TRACE, QUALITY_TRACE, GL, BLOCK, VIEWPORT, UNCAPPED, REQUESTS, SIZE, FORMAT = 'png', NOWEBGL, REDUCED } = process.env
const hosts = new Map() // host → request count (REQUESTS=1)
const [vw, vh] = (VIEWPORT ?? SIZE ?? '1280x800').split('x').map(Number)
const READY = {
  all: '!!window.__smartTree && window.__smartTree.registry.list().every(m => m.model)',
  core: "!!document.querySelector('.loading.is-done')",
  none: 'true',
}

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  ...(GL === 'gpu' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']),
  ...(UNCAPPED ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : []),
  ...(NOWEBGL ? ['--disable-webgl', '--disable-3d-apis'] : []),
  '--window-size=1280,800', 'about:blank',
], { stdio: 'ignore' })

let target
for (let i = 0; i < 50 && !target; i++) {
  await sleep(300)
  try { target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json() } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
const errors = []
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  if (msg.method === 'Network.requestWillBeSent') {
    const u = msg.params.request.url
    const host = /^(data|blob):/.test(u) ? u.slice(0, 5) : new URL(u).host
    hosts.set(host, (hosts.get(host) ?? 0) + 1)
  }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type))
    errors.push(`${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`)
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value

fs.mkdirSync(outDir, { recursive: true })
await send('Runtime.enable')
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: vw, height: vh, deviceScaleFactor: VIEWPORT ? 2 : 1, mobile: Boolean(VIEWPORT) })
// Phones have a coarse pointer (the app picks its quality tier from it).
if (VIEWPORT) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
if (REDUCED) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await send('Network.enable')
if (THROTTLE) {
  await send('Network.setCacheDisabled', { cacheDisabled: true })
  await send('Network.emulateNetworkConditions', { offline: false, ...NETWORK[THROTTLE] })
  console.log(`throttle ${THROTTLE}`)
}
if (BLOCK) await send('Network.setBlockedURLs', { urls: BLOCK.split(',').map((u) => `*${u}*`) })
await send('Page.navigate', { url })

const t0 = Date.now()
const SAMPLE = `(() => {
  const app = window.__smartTree
  return {
    screen: document.querySelector('.loading')?.classList.contains('is-done') ? 'hidden' : document.querySelector('.loading__percent')?.textContent,
    pill: document.querySelector('.load-status')?.hidden === false ? document.querySelector('.load-status').textContent : '-',
    models: app ? app.registry.list().filter(m => m.model).map(m => m.id + ':' + m.variant).join(' ') : '',
    quality: app ? app.quality.name + ' dpr ' + app.renderer.getPixelRatio() + ' fps ' + (app.fps?.toFixed(1) ?? '-') : '',
  }
})()`
let ready = false
let lastLine = ''
while (!ready && Date.now() - t0 < 300_000) {
  await sleep(TRACE ? 250 : 1000)
  if (TRACE) {
    const s = await evaluate(SAMPLE)
    const line = s ? `screen ${s.screen} | pill ${s.pill} | ${s.models.split(' ').filter(Boolean).length} models${QUALITY_TRACE ? ' | ' + s.quality : ''}` : ''
    if (line && line !== lastLine) console.log(`${((Date.now() - t0) / 1000).toFixed(2).padStart(6)}s  ${line}`)
    lastLine = line
  }
  ready = await evaluate(READY[WAIT])
}
console.log(ready ? `ready in ${((Date.now() - t0) / 1000).toFixed(0)}s` : 'TIMEOUT waiting for models')

for (const shot of shots) {
  const [name, ...js] = shot.split('=')
  if (js.length) {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${js.join('=')} })()`, awaitPromise: true, returnByValue: true })
    if (r.result?.exceptionDetails) console.log(`eval error in ${name}:`, r.result.exceptionDetails.exception?.description)
    else if (r.result?.result?.value !== undefined) console.log(`${name} →`, JSON.stringify(r.result.result.value))
  }
  await sleep(1500)
  const { result } = await send('Page.captureScreenshot', { format: FORMAT, ...(FORMAT === 'webp' && { quality: 85 }) })
  fs.writeFileSync(path.join(outDir, `${name}.${FORMAT}`), Buffer.from(result.data, 'base64'))
  console.log(`shot ${name}`)
}
if (REQUESTS) console.log('requests by host:', JSON.stringify(Object.fromEntries(hosts)))
console.log(errors.length ? `console errors:\n${errors.join('\n')}` : 'no console errors')
ws.close()
chrome.kill()
process.exit(0)
