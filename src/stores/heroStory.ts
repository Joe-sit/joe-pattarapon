import { useSyncExternalStore } from 'react'

/**
 * Whether the jigsaw has finished assembling.
 *
 * The hero copy waits on this: the sentence only lands once the pieces the orbs
 * carried in have clicked together.
 */
let done = false
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return done
}

export function setPuzzleDone() {
  if (done) return
  done = true
  listeners.forEach((l) => l())
}

export function usePuzzleDone(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
