import { config } from '../../app/config.js'

// (d) Closed-loop water: trunk turns x-ray, water flows tank → pump → roots → back to the tank
// (docs/business_plan.md §4). The pump state (`pump:state`, dashboard in Tahap 11) drives the flow.
export default {
  id: 'water',
  tree: true,
  assembly: 'assembled',
  interactive: true,
  ui: {
    card: {
      kicker: 'story.water.kicker',
      title: 'story.water.title',
      body: ['story.water.body1'],
      points: ['story.water.steps.tank', 'story.water.steps.pump', 'story.water.steps.roots', 'story.water.steps.return'],
    },
  },
  enter({ water, xray, instant }) {
    water.setVisible(true, { instant })
    xray.set('trunk_base', config.water.xrayOpacity, { instant })
  },
  exit({ water, xray, instant }) {
    water.setVisible(false, { instant })
    xray.set('trunk_base', 1, { instant })
  },
}
