import { on } from '../app/state.js'

const RELOAD_AFTER_MS = 6000

// Shown while the WebGL context is lost (`webgl:lost` → `webgl:restored`). If the browser has not
// restored it after a few seconds, a reload button appears; the chapter on screen is kept across
// the reload (App saves it in sessionStorage).
export function createContextNotice(notice) {
  const reload = notice.querySelector('.context-notice__reload')
  let timer = null
  reload.addEventListener('click', () => location.reload())

  on('webgl:lost', () => {
    notice.hidden = false
    reload.hidden = true
    clearTimeout(timer)
    timer = setTimeout(() => (reload.hidden = false), RELOAD_AFTER_MS)
  })
  on('webgl:restored', () => {
    clearTimeout(timer)
    notice.hidden = true
  })
}
