import { emit, on } from '../app/state.js'
import { ROADMAP } from '../data/roadmap.js'
import { createRndBadge } from './demoBadge.js'
import { reportInset as report } from './inset.js'
import { enterStagger, fadeIn } from './motion.js'
import { richText } from './richText.js'

// Roadmap panel (chapter f), shown when the chapter definition sets ui.roadmap. Groups by status
// (src/data/roadmap.js). Items of the `rnd` group always carry the "Tahap R&D" badge and never
// link to the 3D model. Hover/focus on a linked item emits `modules:highlight {ids}`.
export function createRoadmap(panel) {
  const groupsEl = panel.querySelector('.roadmap__groups')
  const texts = [] // [element, i18n key, facts?] re-rendered on lang:change
  let shown = false

  const text = (tag, className, key, facts) => {
    const el = document.createElement(tag)
    el.className = className
    texts.push([el, key, facts])
    return el
  }

  for (const group of ROADMAP) {
    const section = document.createElement('section')
    section.className = `roadmap__group roadmap__group--${group.id}`
    const list = document.createElement('ul')
    list.className = 'roadmap__items'
    section.append(
      text('h3', 'roadmap__group-title', `roadmap.groups.${group.id}.title`),
      text('p', 'roadmap__group-text', `roadmap.groups.${group.id}.text`),
      list,
    )
    for (const item of group.items) {
      const li = document.createElement('li')
      li.className = 'roadmap__item'
      li.dataset.item = `${group.id}.${item.id}`
      const head = document.createElement('div')
      head.className = 'roadmap__item-head'
      head.append(text('strong', 'roadmap__item-title', `roadmap.items.${group.id}.${item.id}.title`))
      if (group.status === 'rnd') {
        li.dataset.status = 'rnd'
        head.append(createRndBadge({ compact: true }))
      }
      li.append(head)
      if (!item.brief) li.append(text('p', 'roadmap__item-text', `roadmap.items.${group.id}.${item.id}.text`, item.facts))
      if (item.modules?.length) {
        li.tabIndex = 0 // focusable so keyboard users get the same highlight
        const highlight = (ids) => () => emit('modules:highlight', { ids })
        li.addEventListener('pointerenter', highlight(item.modules))
        li.addEventListener('pointerleave', highlight([]))
        li.addEventListener('focus', highlight(item.modules))
        li.addEventListener('blur', highlight([]))
      }
      list.append(li)
    }
    groupsEl.append(section)
  }

  function render() {
    for (const [el, key, facts] of texts) el.replaceChildren(...richText(key, facts))
  }

  const reportInset = () => report('roadmap', panel, shown)

  on('chapter:change', ({ ui }) => {
    const appearing = Boolean(ui.roadmap) && !shown
    shown = Boolean(ui.roadmap)
    panel.hidden = !shown
    if (appearing) {
      fadeIn(panel)
      enterStagger(panel.querySelectorAll('.roadmap__group-title, .roadmap__item, .roadmap__closing'), { gap: 0.03, delay: 0.06 })
    }
    if (!shown) emit('modules:highlight', { ids: [] })
    reportInset()
  })
  on('lang:change', () => {
    render()
    reportInset()
  })
  new ResizeObserver(reportInset).observe(panel)
  addEventListener('resize', reportInset)
  render()
}
