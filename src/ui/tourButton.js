import { emit, on } from '../app/state.js'
import { t } from '../i18n/i18n.js'

const USER_INPUT = ['pointerdown', 'wheel', 'touchstart', 'keydown']

// Auto-tour control: the play/pause button and the T key emit `tour:toggle`; any other user input
// (click, drag, wheel, touch, key) emits `tour:interrupt`, which pauses a running tour.
// Input on the tour button itself is not an interruption. Reflects `tour:state`.
export function createTourButton(button) {
  const label = button.querySelector('.tour-toggle__label')
  let playing = false

  function render() {
    const key = playing ? 'tour.pause' : 'tour.play'
    label.textContent = t(key)
    button.setAttribute('aria-label', `${t(key)} (T)`)
    button.title = `${t(key)} (T)`
    button.setAttribute('aria-pressed', String(playing))
  }

  const typing = (target) => target.closest?.('input, textarea, select, [contenteditable="true"]')

  button.addEventListener('click', () => emit('tour:toggle'))
  for (const type of USER_INPUT) {
    addEventListener(
      type,
      (e) => {
        if (!playing || button.contains(e.target)) return
        // T toggles the tour itself; F only switches fullscreen (ui/presenter.js).
        if (type === 'keydown' && 'tTfF'.includes(e.key) && e.key.length === 1 && !typing(e.target)) return
        emit('tour:interrupt')
      },
      { capture: true, passive: true },
    )
  }
  document.addEventListener('keydown', (e) => {
    if ((e.key !== 't' && e.key !== 'T') || e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return
    if (document.body.classList.contains('is-loading')) return
    emit('tour:toggle')
  })

  on('tour:state', (e) => {
    playing = e.playing
    render()
  })
  on('lang:change', render)
  render()
}
