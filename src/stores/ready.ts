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
  setSceneProgress(1)
  listeners.forEach((l) => l())
}

// ไม่มี reset: สปแลชขึ้นเฉพาะรอบที่ "เปิดเว็บมาลงที่" /joespresso (landedOn ใน App)
// เดินเข้าออกหน้าทีหลังไม่มีใครรอสัญญาณนี้อีก ธงจึงตายไปกับ tab ที่ปิด

export function useSceneReady(): boolean {
  return useSyncExternalStore(subscribe, get, get)
}

/**
 * ความคืบหน้าของการโหลดฉาก 0..1 — แถบโหลดของสปแลชอ่านค่านี้
 *
 * ไม่ใช่ตัวเลขปลอมที่เดินตามเวลา แต่เป็นสัดส่วน "ไบต์ที่ดาวน์โหลดมาแล้ว" ของไฟล์ฉากจริง
 * (ดู preloadSceneAssets) แถบจึงหมายถึงช่วงดาวน์โหลดตรง ๆ ไม่ใช่ด่านสมมติ
 *
 * โหลดครบแล้วยังเหลือเวลา compile shader ซึ่งวัดเป็นสัดส่วนไม่ได้ — ช่วงนั้นแถบค้างเต็ม
 * แล้วรอสัญญาณ ready ค่อย morph ดีกว่าปล่อยตัวเลขปลอมวิ่งต่อให้ดูเหมือนยังทำงานอยู่
 *
 * เดินหน้าทางเดียว: รายงานค่าที่น้อยกว่าเดิมจะถูกทิ้ง ไม่งั้นแถบจะถอยหลังตอน
 * loader ตัวใหม่เริ่มนับหนึ่งกลางคัน
 */
let progress = 0
const progressListeners = new Set<() => void>()

function subscribeProgress(listener: () => void) {
  progressListeners.add(listener)
  return () => progressListeners.delete(listener)
}

function getProgress() {
  return progress
}

export function setSceneProgress(v: number) {
  const next = Math.min(1, Math.max(0, v))
  if (next <= progress) return
  progress = next
  progressListeners.forEach((l) => l())
}

export function useSceneProgress(): number {
  return useSyncExternalStore(subscribeProgress, getProgress, getProgress)
}
