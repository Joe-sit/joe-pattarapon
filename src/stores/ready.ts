import { useSyncExternalStore } from 'react'

/**
 * "ฉาก 3D พร้อมให้ดูแล้ว" — สปแลชรอสัญญาณนี้ก่อนจะเปิดออก
 *
 * ทำไมไม่ใช้ useProgress().active ของ drei: มันเป็นเท็จได้ระหว่างช่วงว่างของ request
 * ฉากที่โหลดหลายไฟล์จะรายงานว่าจบตั้งแต่ไฟล์แรกยังไม่ครบ (บทเรียนจาก handoff §5)
 * ตัวที่ไม่กำกวมคือ React เอง — component ที่อยู่ "ข้างใน" ขอบเขต Suspense
 * จะ render ไม่ได้จนกว่าทุก promise ในนั้นจะ resolve ครบ ตัวส่งสัญญาณจึงไปแขวนไว้ตรงนั้น
 */
let ready = false
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function get() {
  return ready
}

export function setSceneReady() {
  if (ready) return
  ready = true
  listeners.forEach((l) => l())
}

// ไม่มี reset: สปแลชขึ้นเฉพาะรอบที่ "เปิดเว็บมาลงที่" /joespresso (landedOn ใน App)
// เดินเข้าออกหน้าทีหลังไม่มีใครรอสัญญาณนี้อีก ธงจึงตายไปกับ tab ที่ปิด

export function useSceneReady(): boolean {
  return useSyncExternalStore(subscribe, get, get)
}
