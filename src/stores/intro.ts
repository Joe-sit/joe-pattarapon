import { useSyncExternalStore } from 'react'

/**
 * Whether the splash has finished and the landing page is actually on screen.
 *
 * The page mounts underneath the splash from the first frame, so any scene that
 * animates on mount would play out unseen. Scenes wait on this instead.
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

export function setIntroDone() {
  if (done) return
  done = true
  listeners.forEach((l) => l())
}

export function useIntroDone(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
