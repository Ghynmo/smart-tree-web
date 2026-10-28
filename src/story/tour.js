import { emit, on } from '../app/state.js'
import { CHAPTERS } from '../data/chapters.js'

// Auto tour: plays a step script (src/data/tour.js) on top of the chapter machine. It only emits
// the same bus events as the UI (chapter:go, module:select, assembly:go, pump:state), so a tour
// view is exactly the view a presenter would get by hand.
//   `tour:toggle {play?}` → play / pause (T key, tour button)
//   `tour:interrupt`      → pause (any user input, reported by ui/tourButton.js)
//   emits `tour:state {playing, step, total}`
// Dwell time only runs while the story is settled. Resuming continues the current step if the
// user stayed in its chapter, otherwise starts at the first step of the chapter on screen.
export function createTour({ script, story, controls, loop }) {
  const { steps } = script
  const tour = { playing: false, step: 0, elapsed: 0, timeScale: 1, loop: script.loop, play, pause, toggle }
  let pumpOffByTour = false

  const chapterIndex = (id) => CHAPTERS.indexOf(id)
  const firstStepOf = (index) => Math.max(0, steps.findIndex((s) => chapterIndex(s.chapter) === index))

  function report() {
    emit('tour:state', { playing: tour.playing, step: tour.step, total: steps.length })
  }

  function apply(step) {
    const index = chapterIndex(step.chapter)
    if (story.index !== index) emit('chapter:go', { index })
    const { action = {} } = step
    if ('select' in action) emit('module:select', { id: action.select })
    if (action.assembly) emit('assembly:go', { target: action.assembly })
    if ('pump' in action) {
      emit('pump:state', { on: action.pump })
      pumpOffByTour = !action.pump
    }
  }

  function goTo(i) {
    tour.step = i
    tour.elapsed = 0
    apply(steps[i])
    report()
  }

  function play() {
    if (tour.playing) return
    const current = steps[tour.step]
    const resumeHere = current && chapterIndex(current.chapter) === story.index && tour.step > 0
    tour.playing = true
    controls.autoRotate = true
    controls.autoRotateSpeed = script.autoRotateSpeed
    if (resumeHere) {
      apply(current) // re-assert the step (e.g. the module the user closed), keep its elapsed time
      report()
    } else {
      goTo(story.index <= 0 ? 0 : firstStepOf(story.index))
    }
  }

  function pause() {
    if (!tour.playing) return
    tour.playing = false
    controls.autoRotate = false
    if (pumpOffByTour) {
      emit('pump:state', { on: true }) // never leave the pump off behind the user's back
      pumpOffByTour = false
    }
    report()
  }

  function toggle(shouldPlay = !tour.playing) {
    if (shouldPlay) play()
    else pause()
  }

  loop.add((dt) => {
    if (!tour.playing || !story.settled) return
    tour.elapsed += dt * tour.timeScale
    if (tour.elapsed < steps[tour.step].duration) return
    if (tour.step + 1 < steps.length) goTo(tour.step + 1)
    else if (tour.loop) goTo(0)
    else {
      pause()
      tour.step = 0
      emit('tour:end')
    }
  })

  on('tour:toggle', ({ play: shouldPlay } = {}) => toggle(shouldPlay))
  on('tour:interrupt', pause)
  return tour
}
