import { config } from './config.js'

const KEY = 'smarttree.quality'

// The viewer's choice from the quality menu (ui/qualitySwitch.js): 'auto' | 'low' | 'high'.
// Read by core/quality.js at start-up; a change takes effect after a page reload.
export function readQualityPreference() {
  try {
    const value = localStorage.getItem(KEY)
    return value in config.quality ? value : 'auto'
  } catch {
    return 'auto' // storage blocked
  }
}

export function saveQualityPreference(value) {
  try {
    if (value === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, value)
  } catch {
    // storage blocked: the choice cannot persist; the reload falls back to detection
  }
}
