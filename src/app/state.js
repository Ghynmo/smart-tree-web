// Minimal event bus shared by the 3D layer and the UI layer, so neither imports the other.

const listeners = new Map()
const anyListeners = new Set()

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event).add(fn)
  return () => off(event, fn)
}

export function off(event, fn) {
  listeners.get(event)?.delete(fn)
}

export function emit(event, payload) {
  for (const fn of listeners.get(event) ?? []) fn(payload)
  for (const fn of anyListeners) fn(event, payload)
}

// Called after every event (used by the render loop: any state change may need a new frame).
export function onAny(fn) {
  anyListeners.add(fn)
  return () => anyListeners.delete(fn)
}
