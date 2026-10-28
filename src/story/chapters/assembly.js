// (c) Exploded view on entry; the presenter presses "Rakit kembali" to show the snap sequence.
// Height range from docs/business_plan.md ("150 – 180 cm, Standar Rekomendasi").
export default {
  id: 'assembly',
  tree: true,
  assembly: 'exploded',
  interactive: true,
  ui: {
    card: {
      kicker: 'story.assembly.kicker',
      title: 'story.assembly.title',
      body: ['story.assembly.body1', 'story.assembly.body2'],
      hint: 'story.assembly.hint',
      facts: { height: { value: [150, 180], unit: 'cm' } },
    },
    assemblyToggle: true,
  },
}
