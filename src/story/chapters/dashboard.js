import { config } from '../../app/config.js'

// (e) IoT dashboard (SIMULATION, always labelled "Data demo"). The water stays visible in x-ray so
// the dashboard's pump switch (`pump:state`) visibly starts and stops the flow.
export default {
  id: 'dashboard',
  tree: true,
  assembly: 'assembled',
  interactive: true,
  ui: { dashboard: true },
  enter({ water, xray, instant }) {
    water.setVisible(true, { instant })
    xray.set('trunk_base', config.water.xrayOpacity, { instant })
  },
  exit({ water, xray, instant }) {
    water.setVisible(false, { instant })
    xray.set('trunk_base', 1, { instant })
  },
}
