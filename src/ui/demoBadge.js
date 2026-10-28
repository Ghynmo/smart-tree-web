import { on } from '../app/state.js'
import { t } from '../i18n/i18n.js'

// Status badges. Intentionally have no option to hide or disable them.
//   "Data demo": MANDATORY on the dashboard header and on every dashboard card (simulated values).
//   "Tahap R&D": MANDATORY on every roadmap item still in research (AWG, Water Recovery).
export const createDemoBadge = ({ compact = false } = {}) => createBadge('badges.demo', compact)
export const createRndBadge = ({ compact = false } = {}) => createBadge('badges.rnd', compact)

function createBadge(key, compact) {
  const badge = document.createElement('span')
  badge.className = compact ? 'demo-badge demo-badge--compact' : 'demo-badge'
  const render = () => (badge.textContent = t(key))
  on('lang:change', render)
  render()
  return badge
}
