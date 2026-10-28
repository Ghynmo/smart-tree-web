import { on } from '../app/state.js'
import { LANGUAGES, getLanguage, setLanguage, t } from '../i18n/i18n.js'
import { slideTo } from './motion.js'

// Segmented ID / EN / ع control. A gold pill slides under the active language (spring).
// The pill sits at inline-start and moves by the active button's offset from that edge, so it
// follows the mirrored order in RTL.
export function createLangSwitcher(container) {
  const pill = container.querySelector('.lang-switch__pill')
  let placed = false

  const buttons = LANGUAGES.map((lang) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.lang = lang // so screen readers and font shaping treat the label in its own language
    button.addEventListener('click', () => setLanguage(lang))
    container.append(button)
    return button
  })

  function movePill() {
    const active = buttons.find((b) => b.lang === getLanguage())
    if (!active || !active.offsetWidth) return
    const rtl = getComputedStyle(container).direction === 'rtl'
    const fromStart = rtl ? container.clientWidth - active.offsetLeft - active.offsetWidth : active.offsetLeft
    slideTo(pill, { x: rtl ? -fromStart : fromStart, width: active.offsetWidth }, { instant: !placed })
    placed = true
  }

  function render() {
    for (const button of buttons) {
      const lang = button.lang
      button.textContent = t(`lang.short.${lang}`)
      button.setAttribute('aria-label', t(`lang.names.${lang}`))
      button.setAttribute('aria-pressed', String(lang === getLanguage()))
    }
    // After the dir flip has laid the buttons out again.
    requestAnimationFrame(movePill)
  }

  on('lang:change', render)
  new ResizeObserver(movePill).observe(container)
  document.fonts?.ready.then(movePill)
  render()
}
