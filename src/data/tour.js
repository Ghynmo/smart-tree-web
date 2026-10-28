// Auto tour script (story/tour.js plays it). Each step: chapter id, optional action, and
// `duration` = seconds to dwell AFTER the chapter transition (camera, tree, assembly) has settled,
// so an animation is never cut short. Actions use the same bus events as the UI:
//   select: module id | null   → module:select (fly to the module + info panel / close it)
//   assembly: 'assembled' | 'exploded' → assembly:go
//   pump: true | false         → pump:state
export const TOUR = {
  loop: true, // after the last step start again (booth / kiosk use); false = stop at the end
  autoRotateSpeed: 0.5, // OrbitControls units (2 = one orbit per 30 s); slow drift while touring
  steps: [
    { chapter: 'intro', duration: 6 },
    { chapter: 'reveal', duration: 4 },
    { chapter: 'reveal', action: { select: 'solar_panel' }, duration: 4 },
    { chapter: 'reveal', action: { select: null }, duration: 1.5 },
    { chapter: 'assembly', duration: 3 },
    { chapter: 'assembly', action: { assembly: 'assembled' }, duration: 2 },
    { chapter: 'water', duration: 6 },
    { chapter: 'dashboard', duration: 4 },
    { chapter: 'dashboard', action: { pump: false }, duration: 4 },
    { chapter: 'dashboard', action: { pump: true }, duration: 3 },
    { chapter: 'roadmap', duration: 8 },
  ],
}
