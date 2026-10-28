import { emit, on } from '../app/state.js'
import { formatNumber, t } from '../i18n/i18n.js'
import { phone, reportInset as report } from './inset.js'
import { enterStagger } from './motion.js'
import { richText } from './richText.js'

// Narrative card of the current chapter. Content = i18n keys from the chapter definition
// (`chapter:change` → ui.card): kicker, title, body[], points[] (each key has .title/.text), hint, facts.
// Reports the screen edge it covers as `view:inset` so the 3D view re-centers beside/below it.
// The intro card is the hero over the Arafah illustration, with a start button (→ chapter 2).
// On every chapter change the content rises in line by line (src/ui/motion.js).
export function createStoryCard(card) {
  const kicker = card.querySelector('.story-card__kicker')
  const title = card.querySelector('.story-card__title')
  const body = card.querySelector('.story-card__body')
  const points = card.querySelector('.story-card__points')
  const hint = card.querySelector('.story-card__hint')
  const more = card.querySelector('.story-card__more')
  const cta = card.querySelector('.story-card__cta')
  let spec = null
  let chapter = null
  let index = 0
  let expanded = false

  function render() {
    card.hidden = !spec
    if (spec) {
      const intro = chapter === 'intro'
      kicker.textContent = intro ? t(spec.kicker) : `${formatNumber(index + 1, { minimumIntegerDigits: 2 })} · ${t(spec.kicker)}`
      title.textContent = t(spec.title)
      body.replaceChildren(
        ...(spec.body ?? []).map((key) => {
          const p = document.createElement('p')
          p.append(...richText(key, spec.facts))
          return p
        }),
      )
      points.replaceChildren(
        ...(spec.points ?? []).map((key) => {
          const li = document.createElement('li')
          const strong = document.createElement('strong')
          strong.textContent = t(`${key}.title`)
          const text = document.createElement('span')
          text.textContent = t(`${key}.text`)
          li.append(strong, text)
          return li
        }),
      )
      points.hidden = !spec.points?.length
      hint.textContent = spec.hint ? t(spec.hint) : ''
      hint.hidden = !spec.hint
      const extra = (spec.body?.length ?? 0) > 1 || spec.points?.length || spec.hint
      more.hidden = intro || !(phone.matches && extra)
      more.textContent = t(expanded ? 'story.less' : 'story.more')
      more.setAttribute('aria-expanded', String(expanded))
      card.toggleAttribute('data-expanded', expanded || intro)
    }
    cta.hidden = chapter !== 'intro'
    reportInset()
  }

  // The intro card is a hero over an empty scene: it covers nothing the 3D view must avoid.
  const reportInset = () => report('story', card, Boolean(spec) && chapter !== 'intro')

  const visibleLines = () =>
    [kicker, title, ...body.children, ...points.children, hint, more, cta].filter((el) => el.getClientRects().length)

  more.addEventListener('click', () => {
    expanded = !expanded
    render()
  })
  cta.addEventListener('click', () => emit('chapter:go', { index: 1 }))
  on('chapter:change', ({ id, index: i, ui }) => {
    const changed = id !== chapter
    spec = ui.card ?? null
    chapter = id
    index = i
    expanded = false
    card.dataset.chapter = id
    render()
    if (spec && changed) enterStagger(visibleLines(), id === 'intro' ? { y: 22, delay: 0.3, gap: 0.09 } : { delay: 0.05 })
  })
  on('lang:change', render)
  phone.addEventListener('change', render)
  new ResizeObserver(reportInset).observe(card)
  addEventListener('resize', reportInset)
}
