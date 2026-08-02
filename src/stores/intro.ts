import { useSyncExternalStore } from 'react'

/**
 * Two beats of the splash the page underneath needs to know about.
 *
 * `eyeOpen` is the one scenes animate from: the aperture is open, so whatever
 * they do is on screen even though the splash has not cleared yet. `introDone`
 * is the later beat, once the aperture has swallowed the frame.
 */
let eyeOpen = false
let done = false
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function announce() {
  listeners.forEach((l) => l())
}

function getEyeOpen() {
  return eyeOpen
}

function getDone() {
  return done
}

export function setEyeOpen() {
  if (eyeOpen) return
  eyeOpen = true
  announce()
}

export function setIntroDone() {
  // Straight to the landing page (splash disabled) still has to open the gate.
  eyeOpen = true
  if (done) return
  done = true
  announce()
}

export function useEyeOpen(): boolean {
  return useSyncExternalStore(subscribe, getEyeOpen, getEyeOpen)
}

export function useIntroDone(): boolean {
  return useSyncExternalStore(subscribe, getDone, getDone)
}
