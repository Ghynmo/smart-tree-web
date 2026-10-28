// Render loop that pauses while the tab is hidden. `render` draws one frame (see core/pipeline.js).
// Renders on demand: updates run every animation frame, but a frame is only drawn while something
// is active (`addActivity(() => bool)`) or after `invalidate()`. A still scene costs no GPU time,
// which keeps a laptop cool (and unthrottled) during a long presentation.
export function createLoop(renderer, render) {
  const updates = new Set()
  const activities = new Set()
  let last = performance.now()
  let pending = 2 // frames still to draw after an invalidate()
  let rendered = 0

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    for (const fn of updates) fn(dt)
    let active = pending > 0
    if (!active) for (const fn of activities) if (fn()) { active = true; break }
    if (!active) return
    render()
    rendered++
    pending = Math.max(0, pending - 1)
  }

  function start() {
    last = performance.now()
    pending = 2
    renderer.setAnimationLoop(frame)
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) renderer.setAnimationLoop(null)
    else start()
  })

  return {
    start,
    add(fn) {
      updates.add(fn)
      return () => updates.delete(fn)
    },
    // fn() → true while it needs continuous frames (tweens, flowing water, auto-rotate…).
    addActivity(fn) {
      activities.add(fn)
      return () => activities.delete(fn)
    },
    // Draw the next `frames` frames (a few, so damped/async changes settle on screen).
    invalidate(frames = 2) {
      pending = Math.max(pending, frames)
    },
    get rendered() {
      return rendered
    },
  }
}
