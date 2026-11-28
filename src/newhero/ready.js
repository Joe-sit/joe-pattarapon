import { useSyncExternalStore } from 'react'

/**
 * "ฉาก /new-hero วาดได้จริงแล้ว" — สปแลชรอสัญญาณนี้ก่อนเปิดออก
 *
 * ไม่ใช่แค่ "ไฟล์โหลดจบ": หลังจาก GLB ถูกแตกเสร็จยังเหลือการคอมไพล์ shader ทุกวัสดุ
 * ซึ่งทำบน main thread และกินเวลาเป็นวินาที ถ้าเปิดสปแลชออกตอนไฟล์โหลดจบเฉย ๆ
 * คนดูจะเจอจอเปล่าต่ออีกพักหนึ่ง แล้วอินโทรก็เริ่มไปแล้วระหว่างนั้น
 *
 * ตัวส่งสัญญาณคือ SceneReady ในฉาก (ดู NewHeroScene) ซึ่งรอสามด่านตามลำดับ:
 * ตัวละครขึ้นครบ → สั่งคอมไพล์ทั้งฉากทีเดียว → เฟรมเดินเป็นปกติติดกันสามเฟรม
 */
let ready = false
const listeners = new Set()

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function get() {
  return ready
}

export function setNewHeroReady() {
  if (ready) return
  ready = true
  listeners.forEach((l) => l())
}

/** ออกจากหน้าแล้วต้องล้าง — เข้ามาใหม่ต้องรอฉากใหม่คอมไพล์อีกรอบ ไม่ใช่ผ่านฉลุยเพราะธงค้าง */
export function resetNewHeroReady() {
  if (!ready) return
  ready = false
  listeners.forEach((l) => l())
}

export function useNewHeroReady() {
  return useSyncExternalStore(subscribe, get, get)
}
