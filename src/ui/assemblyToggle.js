import { emit, on } from '../app/state.js'
import { t } from '../i18n/i18n.js'

// "Bongkar / Rakit" button, shown in chapters whose definition sets ui.assemblyToggle.
// The label names the action it will trigger, following the controller's *target*,
// so a mid-animation click reverses the animation.
export function createAssemblyToggle(button) {
  let target = 'assembled'

  function render() {
    const exploding = target === 'exploded'
    button.textContent = t(exploding ? 'assembly.assemble' : 'assembly.explode')
    button.setAttribute('aria-pressed', String(exploding))
  }

  button.addEventListener('click', () => emit('assembly:go'))
  on('assembly:state', (e) => {
    target = e.target
    render()
  })
  on('chapter:change', ({ ui }) => (button.hidden = !ui.assemblyToggle))
  on('lang:change', render)
  render()
}
