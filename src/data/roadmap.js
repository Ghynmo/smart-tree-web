// Roadmap (chapter f). Text lives in the locales (roadmap.groups.<group>.*, roadmap.items.<group>.<item>.*).
// Source: docs/business_plan.md. The plan has no timeline, so groups are by status, never by date:
//   core  features of the Smart Tree design shown in this 3D model (§2, §4, Benefits)
//   app   "Fitur Tambahan Apps" (§4)
//   rnd   still in research: AWG / Penangkap Embun and Water Recovery & Transpirasi (confirmed by
//         the project owner 2026-10-27). Shown with the "Tahap R&D" badge and NO 3D link: they
//         must never look like running features.
// modules: 3D modules that glow while the item is hovered/focused (none for rnd items).
// brief: title only (the business plan gives just the feature name).
// facts: numbers for {placeholders} in the item text (business plan values only).

export const ROADMAP = [
  {
    id: 'core',
    items: [
      { id: 'modular', modules: ['trunk_base'] },
      { id: 'water', modules: ['green_tank', 'distribution_pipe'] },
      { id: 'iot', modules: ['nutrient_tank', 'battery'] },
      { id: 'solar', modules: ['solar_panel', 'battery'], facts: { power: { value: 120, unit: 'watt' } } },
      { id: 'plants', modules: ['tree_crown', 'branch_apple', 'branch_mango', 'branch_grape', 'branch_orange'] },
    ],
  },
  {
    id: 'app',
    items: [
      { id: 'nutrients', brief: true },
      { id: 'camera', brief: true },
      { id: 'chat', brief: true },
      { id: 'health', brief: true },
    ],
  },
  {
    id: 'rnd',
    status: 'rnd',
    items: [{ id: 'awg' }, { id: 'recovery' }],
  },
]

for (const group of ROADMAP) {
  for (const item of group.items) {
    if (group.status === 'rnd' && item.modules?.length) {
      throw new Error(`roadmap: R&D item "${item.id}" must not link to 3D modules`)
    }
  }
}
