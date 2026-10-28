import { on } from '../app/state.js'
import { readQualityPreference, saveQualityPreference } from '../app/qualityPreference.js'
import { t } from '../i18n/i18n.js'
import { enterStagger, fadeIn } from './motion.js'

const OPTIONS = ['auto', 'low', 'high'] // Otomatis / Lancar / HD

// Graphics quality menu in the top bar. Shows the tier in use (`quality:change`, including an
// automatic downgrade); choosing another option stores it (app/qualityPreference.js) and reloads
// the page, which reopens the same chapter. A reload is needed because switching to HD has to
// download the detailed model files; the URL ?quality= override is dropped so the choice applies.
export function createQualitySwitch(root) {
  const button = root.querySelector('.quality-menu__button')
  const current = root.querySelector('.quality-menu__current')
  const list = root.querySelector('.quality-menu__list')
  const itemsEl = root.querySelector('.quality-menu__items')
  const preference = readQualityPreference()
  let tier = null // tier actually in use

  const items = OPTIONS.map((value) => {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'quality-menu__item'
    item.setAttribute('role', 'menuitemradio')
    item.dataset.value = value
    const name = document.createElement('span')
    name.className = 'quality-menu__name'
    const hint = document.createElement('span')
    hint.className = 'quality-menu__hint'
    item.append(name, hint)
    item.addEventListener('click', () => choose(value))
    itemsEl.append(item)
    return { value, item, name, hint }
  })

  function render() {
    const tierName = tier ? t(`quality.${tier}`) : ''
    current.textContent = tierName
    const mode = t(`quality.${preference}`)
    const label = `${t('quality.label')}: ${preference === 'auto' && tierName ? `${mode} (${tierName})` : mode}`
    button.setAttribute('aria-label', label)
    button.title = label
    list.setAttribute('aria-label', t('quality.label'))
    for (const { value, item, name, hint } of items) {
      name.textContent = t(`quality.${value}`)
      hint.textContent = t(`quality.${value}Hint`, { tier: tierName })
      item.setAttribute('aria-checked', String(value === preference))
    }
  }

  function open(show) {
    list.hidden = !show
    button.setAttribute('aria-expanded', String(show))
    if (show) {
      fadeIn(list)
      enterStagger(items.map((i) => i.item), { y: 6, gap: 0.04 })
      items.find((i) => i.value === preference)?.item.focus({ preventScroll: true })
    }
  }

  function choose(value) {
    open(false)
    if (value === preference) return
    saveQualityPreference(value)
    const url = new URL(location.href)
    url.searchParams.delete('quality')
    location.replace(url)
  }

  button.addEventListener('click', () => open(list.hidden))
  // Outside click or Esc closes the menu (Esc is consumed so it does not also close the info panel).
  document.addEventListener('pointerdown', (e) => {
    if (!list.hidden && !root.contains(e.target)) open(false)
  })
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || list.hidden) return
      e.stopPropagation()
      open(false)
      button.focus({ preventScroll: true })
    },
    { capture: true },
  )

  on('quality:change', ({ name }) => {
    tier = name
    render()
  })
  on('lang:change', render)
  render()
}
