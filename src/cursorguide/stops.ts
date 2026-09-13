/**
 * เส้นทางของเคอร์เซอร์นำสายตา — ทะเบียน "จุดจอด" ที่แต่ละ section ลงทะเบียนไว้
 *
 * แนวคิด: เคอร์เซอร์มีตัวเดียวทั้งหน้า ลอยอยู่บนชั้นของตัวเองเหนือทุก section (ดู
 * CursorGuideLayer) ส่วนแต่ละ section แค่บอกว่า "ในจอฉัน ให้มันมาอยู่ตรงนี้" โดยชี้ไปที่
 * element จริงในจอนั้น — ไม่ใช่พิกัดที่กะไว้ตายตัว ของในจอขยับ/จอเปลี่ยนขนาด จุดจอดก็ตามไป
 *
 * ทำไมต้องเป็นชั้นเดียวทั้งหน้า: ถ้าแต่ละ section มีเคอร์เซอร์ของตัวเองในแคนวาสของตัวเอง
 * มันคือของสองชิ้นที่บังเอิญหน้าตาเหมือนกัน — ตัวหนึ่งไถลออกจอ อีกตัวไถลเข้า ผู้ชมไม่ได้
 * เห็น "ตัวเดิมเดินทางต่อ" ซึ่งเป็นทั้งหมดของเรื่องที่จะเล่า
 *
 * ตำแหน่งคิดจาก "หัวอ่าน" = กลางวิวพอร์ตในพิกัดของหน้า เลื่อนจอคือเลื่อนหัวอ่านไปตามเส้น
 * จุดจอดเรียงตามตำแหน่งจริงในหน้า (ไม่ใช่ตามลำดับที่ลงทะเบียน) เคอร์เซอร์จึงวิ่งจากจุดหนึ่ง
 * ไปอีกจุดหนึ่งต่อเนื่องข้าม section โดยไม่มีใครต้องรู้เรื่องของกันและกัน
 */

export type Stop = {
  /** ไอดีไม่ซ้ำ — ใช้ถอนทะเบียนตอน unmount */
  id: string
  /** element ที่เคอร์เซอร์ต้องไปหา (ไม่มี = ใช้ `at` อิงขอบจอแทน) */
  el: HTMLElement | null
  /**
   * ตำแหน่งเป็นสัดส่วนของวิวพอร์ต (0..1) — ใช้กับจุดที่ต้องอิงขอบจอ ไม่ใช่อิงของในหน้า
   * เช่น "ไปมุมขวาสุดของจอ" ซึ่งไม่มี element ไหนอยู่ตรงนั้นให้เกาะ
   */
  at: { x: number; y: number } | null
  /**
   * จังหวะที่ต้องถึงจุดนี้ = หัวอ่านอยู่ที่กี่เท่าของความสูงจอ (ทับค่าที่คิดจากตำแหน่ง el)
   *
   * จำเป็นเวลาต้องมีหลายจุดจอดในระยะเลื่อนสั้น ๆ ของจอเดียว — ถ้าให้จังหวะมาจากตำแหน่ง
   * บนหน้าเท่านั้น จุดสองจุดที่อยู่ระดับเดียวกันจะถึงพร้อมกัน
   */
  keyVh: number | null
  /** ระหว่างวิ่งมาหาจุดนี้ ให้ยิงตำแหน่งเคอร์เซอร์ไปขับหัวเรื่อง (แม่เหล็กดูดตัวอักษร) */
  drive: boolean
  /** เลื่อนจากกลาง element เป็นสัดส่วนของขนาด element (0.5 = ครึ่งความกว้าง/สูง) */
  dx: number
  dy: number
  /** ขนาดเคอร์เซอร์ที่จุดนี้ (พิกเซล ความสูงของลูกศร) */
  size: number
  /** เอียงลูกศรกี่เรเดียน ที่จุดนี้ */
  tilt: number
  /** โก่งขึ้นระหว่างทางมาจุดนี้ กี่พิกเซล */
  lift: number
}

const stops = new Map<string, Stop>()

/** ลงทะเบียนจุดจอด — คืนฟังก์ชันถอนทะเบียน */
export function addStop(s: Stop) {
  stops.set(s.id, s)
  return () => {
    stops.delete(s.id)
  }
}

import * as THREE from 'three'
import { heroCursor } from './heroCursor'

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => v * v * (3 - 2 * v)

export type CursorPose = {
  x: number
  y: number
  size: number
  /** ทิศหันของลูกศร — ควอเทอร์เนียน ไม่ใช่มุมเอียงแกนเดียว */
  q: THREE.Quaternion
  ok: boolean
  drive: boolean
}

/**
 * ที่พักค่าระดับโมดูล — ฟังก์ชันนี้ถูกเรียกทุกเฟรม สร้าง Quaternion ใหม่ทุกครั้งคือขยะ
 * ให้ GC เก็บเปล่า ๆ (ดู r3f: ห้ามจองอ็อบเจกต์ใน useFrame)
 */
const _qa = new THREE.Quaternion()
const _qb = new THREE.Quaternion()
const _qo = new THREE.Quaternion()
const _e = new THREE.Euler()

/** ทิศหันที่จุดจอดทั่วไป: แบนติดจอ เอียงรอบแกนลึกเท่าที่จุดนั้นสั่ง */
function flat(out: THREE.Quaternion, tilt: number) {
  return out.setFromEuler(_e.set(0, 0, tilt))
}

/**
 * ตำแหน่งเคอร์เซอร์ ณ ระยะเลื่อนปัจจุบัน — พิกัดพิกเซลของวิวพอร์ต (0,0 = มุมซ้ายบน)
 *
 * อ่าน rect สด ๆ ทุกครั้งที่ถาม ไม่แคช: จุดจอดต้องเกาะของจริงในจอ ซึ่งเลื่อนตามหน้าอยู่แล้ว
 * ของมีไม่กี่ชิ้น (จอละหนึ่งถึงสามจุด) การวัดจึงถูกกว่าการเก็บสถานะให้ตรงกัน
 */
export function cursorPose(): CursorPose {
  const vh = window.innerHeight || 1
  const sx = window.scrollX
  const sy = window.scrollY
  const vw = window.innerWidth || 1
  const list = [...stops.values()]
    .map((s) => {
      /**
       * จังหวะ (key) กับตำแหน่ง แยกกันคิด
       *
       * key คือ "หัวอ่านอยู่ที่ไหนตอนถึงจุดนี้" ส่วนตำแหน่งคือ "อยู่ตรงไหนตอนนั้น"
       * จุดที่อิงของในหน้า (el) ได้ทั้งสองอย่างจาก rect เดียว แต่จุดที่อิงขอบจอ (at)
       * ต้องแปลงกลับ: ตอนหัวอ่านถึง key ระยะเลื่อนคือ key - vh/2 จึงบวกกลับเป็นพิกัดหน้า
       */
      if (s.el) {
        const r = s.el.getBoundingClientRect()
        const x = r.left + r.width * (0.5 + s.dx) + sx
        const y = r.top + r.height * (0.5 + s.dy) + sy
        return {
          x,
          y,
          key: s.keyVh === null ? y : s.keyVh * vh,
          size: s.size,
          tilt: s.tilt,
          q: null as THREE.Quaternion | null,
          lift: s.lift,
          drive: s.drive,
        }
      }
      const a2 = s.at ?? { x: 0.5, y: 0.5 }
      const key = (s.keyVh ?? 1) * vh
      return {
        x: a2.x * vw + sx,
        y: key - vh * 0.5 + a2.y * vh,
        key,
        size: s.size,
        tilt: s.tilt,
        q: null as THREE.Quaternion | null,
        lift: s.lift,
        drive: s.drive,
      }
    })
    /**
     * จุดจอดแรกคือเคอร์เซอร์ตัวจริงในฉากจอแรก ไม่ใช่หมุดที่วางไว้ในหน้า
     *
     * ฉากจอแรกถูกตรึงเต็มจอและอยู่ที่หัวหน้า พิกัดบนจอของมันจึงใช้เป็นพิกัดหน้าได้ตรง ๆ
     * (จอแรกเริ่มที่ y = 0) ขนาดก็เอาความสูงที่เห็นบนจอมาใช้ ชั้นนี้จึงโผล่มาต่อกันพอดี
     * ทั้งตำแหน่งและขนาด
     */
    .concat(
      heroCursor.ok
        /**
         * จังหวะของจุดนี้คือ "หัวอ่านตอนยังไม่เลื่อน" (vh/2) ไม่ใช่ตำแหน่งบนจอของมัน
         *
         * ถ้าใช้ตำแหน่งเป็นจังหวะ การเดินทางจะยังไม่เริ่มจนเลื่อนไปถึงระดับที่เคอร์เซอร์ลอย
         * อยู่ (ซึ่งอยู่ค่อนล่างของจอ) — ผู้ใช้เลื่อนแล้วของนิ่งอยู่พักหนึ่งก่อนจะออกตัว
         */
        ? [
            {
              x: heroCursor.x,
              y: heroCursor.y,
              key: vh * 0.5,
              size: heroCursor.size,
              tilt: 0,
              /** ทิศของหมุดในฉากจอแรก (สามมิติจริง) ไม่ใช่ลูกศรแบน */
              q: heroCursor.q,
              lift: 0,
              drive: false,
            },
          ]
        : [],
    )
    .sort((a, b) => a.key - b.key)

  if (list.length === 0) return { x: 0, y: 0, size: 0, q: _qo.identity(), ok: false, drive: false }

  /** หัวอ่าน = กลางวิวพอร์ตในพิกัดหน้า */
  const head = sy + vh * 0.5
  const view = (x: number, y: number, size: number, q: THREE.Quaternion, drive = false): CursorPose => ({
    x: x - sx,
    y: y - sy,
    size,
    q,
    ok: true,
    drive,
  })
  /** ทิศหันของจุดจอดหนึ่ง ๆ — จุดที่ไม่ได้ถือควอเทอร์เนียนเองก็ปั้นจากมุมเอียงของมัน */
  const qAt = (out: THREE.Quaternion, s: { q: THREE.Quaternion | null; tilt: number }) =>
    s.q ? out.copy(s.q) : flat(out, s.tilt)

  const first = list[0]
  /**
   * ยังไม่ออกเดินทาง — เกาะหมุดในฉากจอแรกนิ่ง ๆ
   *
   * ชั้นนี้วาดตั้งแต่เฟรมแรก ไม่ได้รอรับช่วง: ลูกศรที่เห็นมุมซ้ายล่างของจอแรกคือตัวนี้เอง
   * เงื่อนไข ok จึงเป็น "หมุดขึ้นฉากแล้วหรือยัง" ไม่ใช่ "ฉากจอแรกวาดอยู่ไหม"
   */
  if (list.length === 1 || head <= first.key) {
    return { ...view(first.x, first.y, first.size, qAt(_qo, first)), ok: heroCursor.ok }
  }
  const last = list[list.length - 1]
  if (head >= last.key) return view(last.x, last.y, last.size, qAt(_qo, last))

  let i = 0
  while (i < list.length - 2 && head > list[i + 1].key) i += 1
  const a = list[i]
  const b = list[i + 1]
  const t = smooth(clamp01((head - a.key) / Math.max(1, b.key - a.key)))
  qAt(_qa, a)
  qAt(_qb, b)
  return view(
    a.x + (b.x - a.x) * t,
    /* โก่งขึ้นกลางทาง — ของที่วิ่งเป็นเส้นตรงเป๊ะอ่านเป็นของที่ถูกลาก ไม่ใช่ของที่ลอยไป */
    a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * b.lift,
    a.size + (b.size - a.size) * t,
    /* หมุนแบบ slerp: ทิศตั้งต้นเป็นการหันในสามมิติ เกลี่ยทีละแกนแล้วจะพลิกผิดทาง */
    _qo.copy(_qa).slerp(_qb, t),
    b.drive,
  )
}
