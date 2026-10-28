import { config } from '../app/config.js'
import { readQualityPreference } from '../app/qualityPreference.js'

// Picks the quality tier. Priority: `?quality=low|high` (checks, presenter URLs), then the viewer's
// menu choice (app/qualityPreference.js), then detection (phones and low-memory devices get `low`).
// A chosen tier is `forced`: the adaptive downgrade stays off, so a deliberate "HD" is never lowered.
export function detectQuality() {
  const params = new URLSearchParams(location.search)
  const fromUrl = params.get('quality')
  const preference = readQualityPreference()
  const forced = fromUrl in config.quality ? fromUrl : preference !== 'auto' ? preference : null
  let name
  if (forced) name = forced
  else {
    const coarse = matchMedia('(pointer: coarse)').matches
    const small = Math.min(screen.width, screen.height) < 900
    const lowMemory = (navigator.deviceMemory ?? 8) <= 4
    name = (coarse && small) || lowMemory ? 'low' : 'high'
  }
  return withOverrides({ name, forced: Boolean(forced), ...config.quality[name] }, params)
}

// ?aa= and ?lighting= override a tier's settings (performance checks, weak presentation GPUs).
export function withOverrides(quality, params = new URLSearchParams(location.search)) {
  const aa = params.get('aa')
  const lighting = params.get('lighting')
  return {
    ...quality,
    ...(['fxaa', 'msaa', 'none'].includes(aa) && { aa }),
    ...(['env', 'probe'].includes(lighting) && { lighting }),
  }
}

// Measures FPS in 1 s windows on the render loop and calls onLow(fps) after `seconds` consecutive
// windows under `minFps`. onLow returns true while more downgrade steps exist: the watcher then
// skips `cooldown` windows (model swaps hitch) and keeps watching. It measures until stop().
// A window stretched by a paused loop (hidden tab) is discarded instead of counted as slow.
// The threshold adapts to the display: min(minFps, 85 % of the fastest window seen). With render on
// demand, idle windows run at the refresh rate, so a 48–50 Hz panel is not mistaken for a slow GPU.
export function watchFps(loop, { minFps, seconds, cooldown = 3 }, onLow) {
  const watcher = { fps: null, refresh: 0, threshold: minFps, stop: null }
  let frames = 0
  let start = performance.now()
  let slow = 0
  let skip = 0
  let done = false

  watcher.stop = loop.add(() => {
    frames++
    const now = performance.now()
    const elapsed = now - start
    if (elapsed < 1000) return
    const paused = elapsed > 2000
    watcher.fps = paused ? watcher.fps : (frames * 1000) / elapsed
    frames = 0
    start = now
    if (paused || done) return
    watcher.refresh = Math.max(watcher.refresh, watcher.fps)
    watcher.threshold = Math.min(minFps, watcher.refresh * 0.85)
    if (skip > 0) return void skip--
    slow = watcher.fps < watcher.threshold ? slow + 1 : 0
    if (slow < seconds) return
    slow = 0
    if (onLow(watcher.fps)) skip = cooldown
    else done = true
  })
  return watcher
}
