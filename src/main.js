import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/overlay.css'
import WebGL from 'three/addons/capabilities/WebGL.js'
import { startApp } from './app/App.js'
import { emit } from './app/state.js'
import { initI18n } from './i18n/i18n.js'
import { initShell } from './ui/shell.js'

initI18n()
initShell()

// No WebGL 2 (old browser, GPU blocklisted, disabled by policy) or a failed start: the UI shows the
// fallback poster instead of a blank page (ui/fallback.js).
if (!WebGL.isWebGL2Available()) emit('webgl:unavailable', { reason: 'unsupported' })
else {
  startApp(document.getElementById('app')).catch((error) => {
    console.error('[app] start failed:', error)
    emit('webgl:unavailable', { reason: 'error' })
  })
}
