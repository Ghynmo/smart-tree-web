import { emit } from '../app/state.js'

const GAP = 16 // px between a panel and the 3D subject
// Same breakpoint as overlay.css: on phones panels sit on top of the screen.
export const phone = matchMedia('(max-width: 600px)')

// Reports the screen edge an overlay panel covers as `view:inset {source, top|bottom|left|right}`
// (core/viewport.js re-centers the 3D view in the remaining area). Not covering, or not rendered
// (hidden by CSS while a phone shows the module sheet) → empty report.
// edge: 'side' (inline-start column on desktop, top block on phones) or 'bottom' (phone sheets).
export function reportInset(source, panel, covering, edge = 'side') {
  if (!covering || !panel.getClientRects().length) return emit('view:inset', { source })
  const rect = panel.getBoundingClientRect()
  if (edge === 'bottom') emit('view:inset', { source, bottom: innerHeight - rect.top + GAP })
  else if (phone.matches) emit('view:inset', { source, top: rect.bottom + GAP })
  else if (document.dir === 'rtl') emit('view:inset', { source, right: innerWidth - rect.left + GAP })
  else emit('view:inset', { source, left: rect.right + GAP })
}
