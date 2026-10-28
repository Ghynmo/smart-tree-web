import { config } from '../app/config.js'
import { emit, on } from '../app/state.js'
import { CHAPTERS } from '../data/chapters.js'
import { formatNumber, isRtl, t } from '../i18n/i18n.js'

const NEXT_KEYS = new Set(['PageDown', 'ArrowRight'])
const PREV_KEYS = new Set(['PageUp', 'ArrowLeft'])
const SWIPE_MAX_MS = 600

// Renders the current chapter and requests changes via `chapter:go`; StoryController answers
// with `chapter:change`. Inputs:
//   buttons; keyboard: PageDown/PageUp (presentation clickers), → / ←, Home / End;
//   horizontal swipe (touch/pen) on `swipeAreas` (the canvas itself is left to orbit dragging).
// Arrow keys are NOT mirrored in RTL: a clicker sending → must always advance (like slide software).
// Swipes ARE mirrored: in RTL, content flows right to left, so swiping right advances.
export function createChapterNav(nav, { swipeAreas = [] } = {}) {
  const prev = nav.querySelector('[data-action="prev"]')
  const next = nav.querySelector('[data-action="next"]')
  const title = nav.querySelector('.chapter-nav__title')
  const count = nav.querySelector('.chapter-nav__count')
  const rail = nav.querySelector('.chapter-nav__rail')
  let index = 0

  const go = (i) => emit('chapter:go', { index: Math.min(Math.max(i, 0), CHAPTERS.length - 1) })

  // Progress rail: one segment per chapter, each a shortcut to its chapter.
  const dots = CHAPTERS.map((_, i) => {
    const dot = document.createElement('button')
    dot.type = 'button'
    dot.className = 'chapter-nav__dot'
    dot.addEventListener('click', () => go(i))
    rail.append(dot)
    return dot
  })

  function render() {
    title.textContent = t(`chapters.${CHAPTERS[index]}`)
    count.textContent = t('nav.chapterOf', {
      current: formatNumber(index + 1),
      total: formatNumber(CHAPTERS.length),
    })
    prev.disabled = index === 0
    next.disabled = index === CHAPTERS.length - 1
    dots.forEach((dot, i) => {
      dot.dataset.state = i < index ? 'done' : i === index ? 'current' : 'todo'
      dot.setAttribute('aria-label', t(`chapters.${CHAPTERS[i]}`))
      if (i === index) dot.setAttribute('aria-current', 'step')
      else dot.removeAttribute('aria-current')
    })
  }

  prev.addEventListener('click', () => go(index - 1))
  next.addEventListener('click', () => go(index + 1))

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (document.body.classList.contains('is-loading')) return // nav is hidden behind the loading screen
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
    let target = null
    if (NEXT_KEYS.has(e.key)) target = index + 1
    else if (PREV_KEYS.has(e.key)) target = index - 1
    else if (e.key === 'Home') target = 0
    else if (e.key === 'End') target = CHAPTERS.length - 1
    if (target === null) return
    e.preventDefault() // PageUp/PageDown would otherwise scroll
    go(target)
  })

  for (const area of swipeAreas) {
    let start = null
    area.addEventListener('pointerdown', (e) => {
      start = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY, t: performance.now() }
    })
    area.addEventListener('pointerup', (e) => {
      if (!start) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      const quick = performance.now() - start.t < SWIPE_MAX_MS
      start = null
      if (!quick || Math.abs(dx) < config.story.swipeMin || Math.abs(dx) < 1.5 * Math.abs(dy)) return
      const forward = isRtl() ? dx > 0 : dx < 0
      go(index + (forward ? 1 : -1))
    })
    area.addEventListener('pointercancel', () => (start = null))
  }

  on('chapter:change', (e) => {
    index = e.index
    render()
  })
  on('lang:change', render)
  render()
}
