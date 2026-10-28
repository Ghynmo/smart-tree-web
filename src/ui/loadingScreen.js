import { on } from '../app/state.js'
import { formatNumber, t } from '../i18n/i18n.js'

const percent = (ratio) => formatNumber(ratio, { style: 'percent', maximumFractionDigits: 0 })

// Full-screen loader for load phase 0 (trunk + internal modules), then a small status pill
// for the phases that stream in the background. Driven by `load:progress` / `load:phase`.
export function createLoadingScreen(screen, pill) {
  const status = screen.querySelector('.loading__status')
  const bar = screen.querySelector('.loading__bar')
  const fill = screen.querySelector('.loading__fill')
  const value = screen.querySelector('.loading__percent')
  const retry = screen.querySelector('.loading__retry')
  let coreRatio = 0
  let backgroundRatio = 0
  let failed = false // core failed: the screen stays with a reload button
  let partialError = false

  document.body.classList.add('is-loading')
  retry.addEventListener('click', () => location.reload())

  function render() {
    status.textContent = t(failed ? 'loading.error' : 'loading.core')
    const shown = Math.round(coreRatio * 100)
    fill.style.inlineSize = `${shown}%`
    screen.style.setProperty('--p', String(shown)) // khatam outline drawn as it loads
    bar.setAttribute('aria-valuenow', String(shown))
    value.textContent = percent(coreRatio)
    pill.textContent = partialError ? t('loading.partialError') : t('loading.background', { percent: percent(backgroundRatio) })
  }

  function hideScreen() {
    document.body.classList.remove('is-loading')
    screen.setAttribute('aria-busy', 'false')
    screen.classList.add('is-done')
    // `hidden` after the fade so the screen leaves the accessibility tree; timer covers reduced motion.
    setTimeout(() => (screen.hidden = true), 600)
  }

  on('load:progress', (e) => {
    screen.classList.add('has-progress')
    if (e.phase === 0) coreRatio = e.phaseRatio
    backgroundRatio = e.backgroundRatio
    render()
  })

  on('load:phase', ({ phase, last, failed: ids }) => {
    if (phase === 0) {
      if (ids.length) {
        failed = true
        retry.hidden = false
        screen.setAttribute('aria-busy', 'false')
        render()
        return
      }
      hideScreen()
      if (!last) pill.hidden = false
    } else if (ids.length) {
      partialError = true
    }
    if (last && !partialError) pill.hidden = true
    render()
  })

  on('lang:change', render)
  render()
}
