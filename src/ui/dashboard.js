import { emit, on } from '../app/state.js'
import { createSim, METRICS } from '../data/sim.js'
import { formatClock, formatNumber, t } from '../i18n/i18n.js'
import { createDemoBadge } from './demoBadge.js'
import { reportInset as report } from './inset.js'
import { enterStagger, fadeIn } from './motion.js'
import { richText } from './richText.js'

const STEP_MS = 250 // simulation tick
const RENDER_EVERY = 2 // ticks per DOM update (2 Hz keeps numbers readable)
const SVG = 'http://www.w3.org/2000/svg'

// IoT dashboard (chapter e), shown when the chapter definition sets ui.dashboard.
// ALL values are simulated (src/data/sim.js): the header and every card carry the mandatory
// "Data demo" badge. The pump switch emits `pump:state {on}` (drives the water flow).
// Reports its covered screen edge as `view:inset {source: 'dashboard'}`.
export function createDashboard(panel) {
  const grid = panel.querySelector('.dashboard__grid')
  const clock = panel.querySelector('.dashboard__clock')
  panel.querySelector('.dashboard__badge').append(createDemoBadge())
  const sim = createSim()
  const cards = METRICS.map((metric) => buildCard(metric))
  grid.append(...cards.map((c) => c.el))
  let timer = null
  let ticks = 0
  let shown = false

  function buildCard(metric) {
    const el = document.createElement('article')
    el.className = `metric metric--${metric.kind ?? 'number'}`
    el.dataset.metric = metric.id
    const head = document.createElement('div')
    head.className = 'metric__head'
    const label = document.createElement('span')
    label.className = 'metric__label'
    head.append(label, createDemoBadge({ compact: true }))
    const value = document.createElement('bdi')
    value.className = 'metric__value'
    value.dir = 'ltr'
    el.append(head, value)
    const card = { metric, el, label, value }

    if (!metric.kind) {
      const svg = document.createElementNS(SVG, 'svg')
      svg.setAttribute('class', 'metric__spark')
      svg.setAttribute('viewBox', '0 0 100 24')
      svg.setAttribute('preserveAspectRatio', 'none')
      svg.setAttribute('aria-hidden', 'true')
      // Line plus a soft gradient area under it.
      const gradientId = `spark-${metric.id}`
      const defs = document.createElementNS(SVG, 'defs')
      const gradient = document.createElementNS(SVG, 'linearGradient')
      gradient.id = gradientId
      gradient.setAttribute('x1', '0')
      gradient.setAttribute('y1', '0')
      gradient.setAttribute('x2', '0')
      gradient.setAttribute('y2', '1')
      for (const [offset, cls] of [['0', 'metric__spark-top'], ['1', 'metric__spark-bottom']]) {
        const stop = document.createElementNS(SVG, 'stop')
        stop.setAttribute('offset', offset)
        stop.setAttribute('class', cls)
        gradient.append(stop)
      }
      defs.append(gradient)
      card.area = document.createElementNS(SVG, 'polygon')
      card.area.setAttribute('fill', `url(#${gradientId})`)
      card.line = document.createElementNS(SVG, 'polyline')
      svg.append(defs, card.area, card.line)
      el.append(svg)
      if (metric.max) {
        card.note = document.createElement('span')
        card.note.className = 'metric__note'
        el.append(card.note)
      }
    } else if (metric.kind === 'switch') {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'metric__switch'
      button.setAttribute('role', 'switch')
      button.addEventListener('click', () => emit('pump:state', { on: !sim.state.pumpOn }))
      el.append(button)
      card.button = button
    }
    return card
  }

  function sparkline(card) {
    const values = sim.history[card.metric.id]
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const mid = (lo + hi) / 2
    const span = Math.max(hi - lo, card.metric.minSpan)
    const points = values.map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * 100
      const y = 21 - ((v - (mid - span / 2)) / span) * 18
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    card.line.setAttribute('points', points.join(' '))
    card.area.setAttribute('points', `0,24 ${points.join(' ')} 100,24`)
  }


  function valueText({ digits, unit, tight }, v) {
    const n = formatNumber(v, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    return unit ? `${n}${tight ? '' : ' '}${t(`units.${unit}`)}` : n
  }

  function render() {
    const s = sim.state
    clock.textContent = t('dashboard.clock', { time: formatClock(s.minutes) })
    for (const card of cards) {
      const { metric } = card
      card.label.textContent = t(`dashboard.metrics.${metric.id}`)
      if (!metric.kind) {
        card.value.textContent = valueText(metric, s[metric.id])
        sparkline(card)
        if (card.note) card.note.replaceChildren(...richText('dashboard.max', { max: { value: metric.max, unit: metric.unit } }))
      } else if (metric.kind === 'switch') {
        card.value.textContent = t(s.pumpOn ? 'dashboard.pump.on' : 'dashboard.pump.off')
        card.button.setAttribute('aria-checked', String(s.pumpOn))
        card.button.setAttribute('aria-label', t('dashboard.pump.toggle'))
        card.el.dataset.on = String(s.pumpOn)
      } else {
        card.value.textContent = t(`dashboard.plant.${s.plant}`)
        card.el.dataset.status = s.plant
      }
    }
  }

  function tick() {
    sim.step(STEP_MS / 1000)
    if (++ticks % RENDER_EVERY === 0) render()
  }

  const reportInset = () => report('dashboard', panel, shown)

  // The simulation only advances while the dashboard is on screen.
  function setShown(visible) {
    const appearing = visible && !shown
    shown = visible
    panel.hidden = !visible
    clearInterval(timer)
    timer = visible ? setInterval(tick, STEP_MS) : null
    if (visible) render()
    reportInset()
    if (appearing) {
      fadeIn(panel)
      enterStagger(cards.map((c) => c.el), { gap: 0.035, delay: 0.08 })
    }
  }

  on('pump:state', ({ on: running }) => {
    sim.setPump(running)
    render()
  })
  on('chapter:change', ({ ui }) => setShown(Boolean(ui.dashboard)))
  on('lang:change', () => {
    render()
    reportInset()
  })
  new ResizeObserver(reportInset).observe(panel)
  addEventListener('resize', reportInset)
  render()

  return { sim }
}
