/**
 * โหมดของฉาก: design (ปกติ) หรือ dev (มืด)
 *
 * เป็น store เล็ก ๆ นอก React เพราะคนเขียนกับคนอ่านอยู่คนละมุมของต้นไม้ component:
 * ปุ่มที่กดอยู่ใน <Panels> ลึกเข้าไปในกลุ่มที่ถูกสเกล ส่วนคนที่ต้องรู้ค่าคือแสง/หมอก/ฟ้า
 * ซึ่งอยู่ระดับ <Scene> การส่งเป็น prop ต้องเจาะผ่านหลายชั้นโดยที่ชั้นกลางไม่ได้ใช้ค่าเลย
 *
 * useSyncExternalStore ทำให้ component ที่สนใจ re-render ตามปกติ ส่วนของที่ไล่ค่าทุกเฟรม
 * (แสง หมอก exposure) อ่าน modeState.dev ตรง ๆ ใน useFrame ได้โดยไม่ต้อง re-render อะไรเลย
 */
import { useSyncExternalStore } from 'react'

export const modeState = {
  /** true = โหมด dev (มืด) — ค่าเริ่มต้นคือ design ตามที่ออกแบบไว้ */
  dev: false,
}

const listeners = new Set()

export function setDevMode(on) {
  if (modeState.dev === on) return
  modeState.dev = on
  for (const fn of listeners) fn()
}

export function toggleDevMode() {
  setDevMode(!modeState.dev)
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** ใช้ในที่ที่ต้อง re-render ตามโหมด (เช่นสีปุ่มบน toolbar) */
export function useDevMode() {
  return useSyncExternalStore(
    subscribe,
    () => modeState.dev,
    () => false,
  )
}

// เปิดช่องให้สลับโหมดจากภายนอกตอน dev — ใช้เก็บภาพเทียบสองโหมดโดยไม่ต้องยิงคลิกเข้าไปในฉาก
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__mode = { state: modeState, set: setDevMode }
}
