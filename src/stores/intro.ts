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

/**
 * ด่านโหลดของ /2026-final (pages/Final2026Gate) ถอดม่านออกแล้ว — หน้าเห็นได้จริงตั้งแต่จังหวะนี้
 *
 * ไม่ใช่ introDone: introDone ยิงตอน *เริ่ม* มอร์ฟ ระหว่างนั้นม่านขาวยังบังหน้าอยู่อีกราว 1.6 วิ
 * ของที่อยากให้คนเห็นท่าโผล่ตั้งแต่ต้น (แถบบน) ต้องรออันนี้
 */
let gateOpen = false
function getGateOpen() {
  return gateOpen
}
export function setGateOpen() {
  if (gateOpen) return
  gateOpen = true
  announce()
}
export function useGateOpen(): boolean {
  return useSyncExternalStore(subscribe, getGateOpen, getGateOpen)
}
