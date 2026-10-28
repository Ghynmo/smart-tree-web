import { CHAPTERS } from '../../data/chapters.js'
import assembly from './assembly.js'
import dashboard from './dashboard.js'
import intro from './intro.js'
import reveal from './reveal.js'
import roadmap from './roadmap.js'
import water from './water.js'

// Chapter definitions in narrative order (order lives in src/data/chapters.js).
// Shape: { id, tree, assembly, interactive, ui: { card?, assemblyToggle? }, enter?(ctx), exit?(ctx) }
//   tree        tree grown (true) or hidden in the ground (false)
//   assembly    'assembled' | 'exploded' target on entry
//   interactive picking (hover/select) allowed
//   ui          sent with `chapter:change` for the overlay (story card i18n keys, toggles)
const BY_ID = { intro, reveal, assembly, water, dashboard, roadmap }

export const CHAPTER_DEFS = CHAPTERS.map((id) => {
  if (!BY_ID[id]) throw new Error(`No chapter definition for "${id}"`)
  return BY_ID[id]
})
