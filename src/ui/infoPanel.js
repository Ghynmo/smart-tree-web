import { emit, on } from '../app/state.js'
import { MODULE_INFO } from '../data/modules.js'
import { t } from '../i18n/i18n.js'
import { phone, reportInset as report } from './inset.js'
import { enterPanel, enterStagger, fadeIn } from './motion.js'
import { richText } from './richText.js'

// Info panel for the selected module. Opens on `module:select {id}`; × and Esc close it by
// emitting `module:select {id: null}` (focus.js then flies the camera back).
// Description placeholders ({power}, {ec}…) are filled from MODULE_INFO facts via richText.
export function createInfoPanel(panel) {
  const title = panel.querySelector('.info-panel__title')
  const pillar = panel.querySelector('.info-panel__pillar')
  const body = panel.querySelector('.info-panel__body')
  const close = panel.querySelector('.info-panel__close')
  let id = null

  function render() {
    if (!id) return
    const info = MODULE_INFO[id] ?? {}
    title.textContent = t(`modules.${id}.name`)
    pillar.textContent = t(`pillars.${info.pillar}`)
    pillar.dataset.pillar = info.pillar
    body.replaceChildren(...richText(`modules.${id}.desc`, info.facts))
  }

  function requestClose() {
    if (id) emit('module:select', { id: null })
  }

  close.addEventListener('click', requestClose)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') requestClose()
  })

  // Phones: the sheet covers the lower screen, so it reports a bottom inset and the 3D view
  // re-centers the module above it. `body[data-module-open]` lets CSS fold away the chapter card
  // (and dashboard / roadmap) meanwhile, so only one explanation covers the model at a time.
  const reportInset = () => report('info', panel, phone.matches && Boolean(id), 'bottom')

  on('module:select', (e) => {
    const opening = !id && e.id
    const switching = id && e.id && id !== e.id
    id = e.id
    panel.hidden = !id
    document.body.toggleAttribute('data-module-open', Boolean(id))
    render()
    reportInset()
    if (opening) {
      // On phones only a fade: a transform would skew the bounds the inset report reads.
      if (phone.matches) fadeIn(panel)
      else enterPanel(panel, 'inline-end')
      close.focus({ preventScroll: true })
    }
    if (opening || switching) enterStagger([pillar, title, body], { delay: 0.06, gap: 0.05 })
  })
  on('lang:change', render)
  phone.addEventListener('change', reportInset)
  new ResizeObserver(reportInset).observe(panel)
}
