import { on } from '../app/state.js'

const typing = (target) => target.closest?.('input, textarea, select, [contenteditable="true"]')

// Presentation helpers:
//   F            toggles fullscreen (no browser chrome on the projector)
//   Wake lock    keeps the screen on while the auto tour runs (booth use); re-acquired when the
//                tab becomes visible again, released when the tour pauses. Silently skipped where
//                the Screen Wake Lock API is missing.
export function initPresenterHelpers() {
  document.addEventListener('keydown', (e) => {
    if ((e.key !== 'f' && e.key !== 'F') || e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  })

  let wakeLock = null
  let wanted = false
  async function acquire() {
    if (!wanted || wakeLock || document.hidden || !navigator.wakeLock) return
    try {
      wakeLock = await navigator.wakeLock.request('screen')
      wakeLock.addEventListener('release', () => (wakeLock = null))
    } catch {
      wakeLock = null // e.g. battery saver or policy: the tour still runs
    }
  }
  on('tour:state', ({ playing }) => {
    wanted = playing
    if (playing) acquire()
    else wakeLock?.release().catch(() => {})
  })
  document.addEventListener('visibilitychange', acquire)
}
