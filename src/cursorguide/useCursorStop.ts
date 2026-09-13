import { useEffect } from 'react'
import type { RefObject } from 'react'
import { addStop } from './stops'

/**
 * ลงทะเบียน element หนึ่งชิ้นเป็น "จุดจอด" ของเคอร์เซอร์นำสายตา
 *
 * section ไม่ต้องรู้ว่าเคอร์เซอร์อยู่ที่ไหนหรือมาจากจอไหน — บอกแค่ว่าในจอนี้ให้มันมาอยู่
 * ตรงชิ้นไหน ที่เหลือ (ลำดับ ทางวิ่ง ความต่อเนื่องข้ามจอ) คิดที่ ./stops
 */
export function useCursorStop(
  ref: RefObject<HTMLElement | null> | null,
  opts: {
    id: string
    /** เลื่อนจากกลาง element เป็นสัดส่วนของขนาดมันเอง */
    dx?: number
    dy?: number
    /** ความสูงลูกศรที่จุดนี้ (พิกเซล) */
    size?: number
    /** เอียงกี่องศา */
    tilt?: number
    /** โก่งขึ้นระหว่างทางมาจุดนี้ (พิกเซล) */
    lift?: number
    /** ตำแหน่งเป็นสัดส่วนวิวพอร์ต — ใช้เมื่อไม่มี element ให้เกาะ (เช่นขอบจอ) */
    at?: { x: number; y: number }
    /** จังหวะที่ถึงจุดนี้ = หัวอ่านที่กี่เท่าความสูงจอ */
    keyVh?: number
    /** ระหว่างวิ่งมาหาจุดนี้ ให้ขับแม่เหล็กของหัวเรื่องด้วยตำแหน่งเคอร์เซอร์ */
    drive?: boolean
  },
) {
  const { id, dx = 0, dy = 0, size = 54, tilt = 0, lift = 0, keyVh, drive = false } = opts
  const ax = opts.at?.x
  const ay = opts.at?.y
  useEffect(() => {
    const el = ref?.current ?? null
    if (!el && ax === undefined) return undefined
    return addStop({
      id,
      el,
      at: ax === undefined ? null : { x: ax, y: ay ?? 0.5 },
      keyVh: keyVh ?? null,
      dx,
      dy,
      size,
      tilt: (tilt * Math.PI) / 180,
      lift,
      drive,
    })
  }, [ref, id, dx, dy, size, tilt, lift, ax, ay, keyVh, drive])
}
