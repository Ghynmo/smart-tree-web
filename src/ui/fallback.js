import { on } from '../app/state.js'

// No WebGL (`webgl:unavailable`): replace the 3D stage with a still poster of the Smart Tree and a
// short explanation, so a presentation on a locked-down machine still shows the product.
// The top bar (brand, language switch) keeps working; texts are data-i18n in index.html.
export function createFallback(section) {
  on('webgl:unavailable', () => {
    document.body.classList.remove('is-loading')
    document.body.classList.add('no-webgl')
    document.querySelector('.loading')?.setAttribute('hidden', '')
    section.hidden = false
  })
}
