// IoT dashboard SIMULATION (chapter e). Every value here is demo data and is always shown with the
// "Data demo" badge. Only pH ≈ 6.2, EC ≈ 1.8 mS/cm and the 120 W panel come from
// docs/business_plan.md; all other constants just keep the demo plausible (hot, dry Arafah day).
// Values follow smoothed random walks (Ornstein-Uhlenbeck) with a seeded PRNG, so a demo run is
// repeatable. The sim clock runs `minutesPerSecond` simulated minutes per real second.

// Display order = the parameter list of the brief. kind: number (default) | switch | status.
// unit: key under units.*; tight: no space before the unit (e.g. "38%").
export const METRICS = [
  { id: 'temperature', unit: 'celsius', digits: 1, minSpan: 1 },
  { id: 'humidity', unit: 'percent', tight: true, digits: 1, minSpan: 4 },
  { id: 'ph', digits: 2, minSpan: 0.2 },
  { id: 'ec', unit: 'msPerCm', digits: 2, minSpan: 0.1 },
  { id: 'waterLevel', unit: 'percent', tight: true, digits: 0, minSpan: 4 },
  { id: 'battery', unit: 'percent', tight: true, digits: 1, minSpan: 4 },
  { id: 'solar', unit: 'watt', digits: 0, minSpan: 10, max: 120 },
  { id: 'pump', kind: 'switch' },
  { id: 'plant', kind: 'status' },
]

const HISTORY = 48 // samples kept per metric for the sparklines
const PANEL_MAX_W = 120 // business plan: Daya Panel Surya (120W)

// Healthy band used for the plant status (demo rule).
const HEALTHY = { ph: [5.8, 6.6], ec: [1.4, 2.2], waterLevel: 30 }

function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

export function createSim({ seed = 20261027, startMinutes = 10 * 60, minutesPerSecond = 1 } = {}) {
  const random = mulberry32(seed)
  // Standard normal (Box-Muller).
  const gauss = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random())
  // One Ornstein-Uhlenbeck step: pull toward mu with rate theta, noise sigma per √s.
  const ou = (x, mu, theta, sigma, dt) => x + theta * (mu - x) * dt + sigma * Math.sqrt(dt) * gauss()

  const state = {
    minutes: startMinutes,
    temperature: 36,
    humidity: 24,
    ph: 6.2,
    ec: 1.8,
    waterLevel: 80,
    battery: 78,
    solar: 0,
    cloud: 0.95,
    pumpOn: true,
    plant: 'good',
  }
  const history = Object.fromEntries(METRICS.filter((m) => !m.kind).map((m) => [m.id, []]))

  function record() {
    for (const [id, list] of Object.entries(history)) {
      list.push(state[id])
      if (list.length > HISTORY) list.shift()
    }
  }

  function step(dt) {
    const s = state
    s.minutes += dt * minutesPerSecond
    const hour = (s.minutes / 60) % 24
    const daylight = Math.max(0, Math.sin((Math.PI * (hour - 6)) / 12)) // 06:00–18:00
    s.cloud = clamp(ou(s.cloud, 0.93, 0.3, 0.05, dt), 0.7, 1)
    s.solar = PANEL_MAX_W * daylight * s.cloud
    s.temperature = ou(s.temperature, 29 + 13 * daylight, 0.15, 0.12, dt)
    s.humidity = clamp(ou(s.humidity, 38 - 18 * daylight, 0.15, 0.25, dt), 5, 95)
    s.ph = clamp(ou(s.ph, 6.2, 0.2, 0.02, dt), 5.5, 7)
    s.ec = clamp(ou(s.ec, 1.8, 0.2, 0.012, dt), 1.2, 2.4)
    // Closed loop: running the pump keeps part of the water in the pipes, so the tank level dips.
    s.waterLevel = clamp(ou(s.waterLevel, s.pumpOn ? 72 : 80, 0.08, 0.15, dt), 0, 100)
    // Battery: charged by the panel, drained by the pump and the electronics (% per real second).
    const charge = (s.solar / PANEL_MAX_W) * 0.25 - (s.pumpOn ? 0.12 : 0) - 0.04
    s.battery = clamp(s.battery + charge * dt, 15, 100)
    const ok = (v, [lo, hi]) => v >= lo && v <= hi
    s.plant = ok(s.ph, HEALTHY.ph) && ok(s.ec, HEALTHY.ec) && s.waterLevel > HEALTHY.waterLevel ? 'good' : 'attention'
    record()
  }

  function setPump(on) {
    state.pumpOn = on
  }

  step(0) // derive solar/plant for the start time and record the first sample
  return { state, history, step, setPump }
}
