import { config } from '../app/config.js'
import { on } from '../app/state.js'

// Glows a set of modules on `modules:highlight {ids}` (e.g. roadmap items); empty ids clears.
// Uses its own glow channel, so it combines cleanly with hover and the assembly pulse.
export function createHighlight({ registry }) {
  let active = []
  on('modules:highlight', ({ ids }) => {
    for (const id of active) registry.get(id)?.setGlow('highlight', 0, 0)
    active = ids.filter((id) => registry.get(id))
    const { color, amount } = config.interaction.highlightGlow
    for (const id of active) registry.get(id).setGlow('highlight', color, amount)
  })
}
