import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useDisposable } from '@/joespresso/scene/utils'

/**
 * สเก็ตบอร์ด — แผ่นเดียวจบ ไม่ใช่กล่องสามใบต่อกัน
 *
 * ของเดิมประกอบจากแผ่นกลาง + แผ่นหัว + แผ่นท้าย เอียงชนกัน จึงเห็นรอยต่อและมุมเหลี่ยม
 * ของจริง (และในภาพอ้างอิง) แผ่นเป็นชิ้นเดียว: ขอบข้างขนานกันตรงกลาง ปลายมนเป็นครึ่งวงกลม
 * และเชิดขึ้นทั้งสองปลายอย่างต่อเนื่อง ไม่มีสันหักที่ไหนเลย
 *
 * จึงปั้นเป็นพื้นผิวกวาด: เดินไปตามความยาว แล้ววาดหน้าตัดที่ตำแหน่งนั้น ๆ
 *   - ความกว้างของหน้าตัดมาจากเส้นขอบทรงสเตเดียม (กลางตรง ปลายโค้งจนกว้างเป็นศูนย์)
 *   - ความสูงของหน้าตัดคือความหนาแผ่น มุมมนด้วยซูเปอร์เอลลิปส์ ได้ขอบนุ่มแบบไม้อัดจริง
 *   - ยกปลายทั้งสองข้างด้วยเส้นโค้งนุ่ม (smoothstep) = คิกที่ไม่มีสันหัก
 *
 * ปั้นในกล่องหน่วยเดียว: ยาว 1 ตามแกน x, กว้างราว 0.3 ตามแกน z, **ล้อแตะ y = 0 พอดี**
 */

const DECK = '#2f4f4a'
const TRUCK = '#c6cbd1'
/** สีลายล้อ — น้ำเงินกับขาวนวล หยิบจากจานสีที่ฉากใช้อยู่ ไม่ได้คิดขึ้นใหม่ */
const WHEEL_BASE = '#4f7df9'
const WHEEL_BLOB = '#f2f4ef'

/** สุ่มแบบมีเมล็ด (mulberry32) — ลายต้องเหมือนกันทุกครั้ง ไม่เปลี่ยนทุกรีเฟรช */
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * สนามค่าสุ่มแบบต่อเนื่องและ "วนรอบ" ทั้งสองแกน
 *
 * ลายหยดน้ำเกิดจากการตัดสนามนี้ที่ระดับหนึ่ง (threshold) — ไม่ได้วาดรูปหยดทีละหยด
 * เพราะรูปทรงที่ได้จากการตัดสนามจะอ้วนผอมไม่ซ้ำกันเอง และต่อกันเป็นแฉกแบบลายวัว
 *
 * กริดวนรอบ (i+1 mod nx) คือสิ่งที่ทำให้ตะเข็บ u=0/1 ต่อสนิท ถ้าไม่วน จะเห็นรอยผ่า
 * พาดขวางล้อทุกครั้งที่หมุนมาถึง
 */
function noiseField(seed, nx, ny) {
  const r = rng(seed)
  const g = new Float32Array(nx * ny)
  for (let i = 0; i < g.length; i += 1) g[i] = r()
  // smoothstep ที่ค่า t ของช่อง = ขอบหยดโค้งนุ่ม ถ้าใช้เชิงเส้นตรง ๆ ขอบจะเป็นเหลี่ยม
  const sm = (t) => t * t * (3 - 2 * t)
  return (u, v) => {
    const x = u * nx
    const y = v * ny
    const i0 = Math.floor(x)
    const j0 = Math.floor(y)
    const fx = sm(x - i0)
    const fy = sm(y - j0)
    const ia = ((i0 % nx) + nx) % nx
    const ja = ((j0 % ny) + ny) % ny
    const ib = (ia + 1) % nx
    const jb = (ja + 1) % ny
    const a = g[ja * nx + ia]
    const b = g[ja * nx + ib]
    const c = g[jb * nx + ia]
    const d = g[jb * nx + ib]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
  }
}

function rgb(hex) {
  const c = new THREE.Color(hex)
  return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]
}

/**
 * ระบายลายหยดลงผ้าใบทีละพิกเซล
 *
 * ไม่ได้ใช้ canvas path เพราะรูปทรงมาจากการตัดสนามค่า ไม่ใช่เส้นที่รู้พิกัดล่วงหน้า
 * ขอบไล่ด้วย smoothstep กว้างแคบ ๆ (EDGE) — ล้อกินที่จอแค่ ~40px ถ้าตัดคมเป๊ะจะเห็นขอบหยัก
 */
const EDGE = 0.035
function paintBlobs(ctx, W, H, level, sample) {
  const img = ctx.createImageData(W, H)
  const base = rgb(WHEEL_BASE)
  const blob = rgb(WHEEL_BLOB)
  for (let py = 0; py < H; py += 1) {
    for (let px = 0; px < W; px += 1) {
      const n = sample((px + 0.5) / W, (py + 0.5) / H)
      const t = Math.max(0, Math.min(1, (n - (level - EDGE)) / (EDGE * 2)))
      const k = t * t * (3 - 2 * t)
      const o = (py * W + px) * 4
      for (let ch = 0; ch < 3; ch += 1) img.data[o + ch] = base[ch] + (blob[ch] - base[ch]) * k
      img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

/**
 * ลายล้อ — หยดน้ำอินทรีย์ชุบทั้งลูก ทั้งผิวสัมผัสและหน้าล้อ
 *
 * ทรงกระบอกมี UV สองแบบคนละเรื่อง จึงต้องวาดสองใบ ใช้ใบเดียวไม่ได้:
 *   - ผิวข้าง: u เดินรอบเส้นรอบวง (0 กับ 1 คือรอยต่อเดียวกัน) v เดินตามความหนาล้อ
 *   - ฝา: วงกลมกลางสี่เหลี่ยมหน่วย (ศูนย์ 0.5,0.5 รัศมี 0.5)
 *
 * ขนาดหยดตั้งจากขนาดโลกจริง ไม่ใช่จำนวนพิกเซล: ผิวข้างยาวเท่าเส้นรอบวง (2π·0.038
 * ≈ 0.239) ฝากว้างเท่าเส้นผ่านศูนย์กลาง (0.076) จึงใช้จำนวนช่องต่างกันเพื่อให้หยด
 * บนผิวสัมผัสกับบนหน้าล้อโตเท่ากัน ตั้งเท่ากันทั้งสองใบหยดบนฝาจะเล็กกว่าสามเท่า
 */
/** ค่าเริ่มของลาย — cell คือขนาดหยดในหน่วยโลก, level คือสัดส่วนน้ำเงิน/ขาว, seed คือหน้าตาลาย */
export const WHEEL_SKIN = { cell: 0.025, level: 0.52, seed: 1 }

function wheelSideTexture(skin = WHEEL_SKIN) {
  const W = 512
  const H = 128
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')
  const around = Math.max(3, Math.round((Math.PI * 2 * BOARD_SPEC.wheelR) / skin.cell))
  const across = Math.max(2, Math.round(BOARD_SPEC.wheelW / skin.cell))
  const f1 = noiseField(1337 + skin.seed * 977, around, across)
  const f2 = noiseField(7717 + skin.seed * 977, around * 2, across * 2)
  paintBlobs(ctx, W, H, skin.level, (u, v) => f1(u, v) * 0.78 + f2(u, v) * 0.22)
  cv.dataset.cells = `${around}x${across}`

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.anisotropy = 4
  return tex
}

function wheelFaceTexture(skin = WHEEL_SKIN) {
  const S = 256
  const cv = document.createElement('canvas')
  cv.width = S
  cv.height = S
  const ctx = cv.getContext('2d')
  const cells = Math.max(2, Math.round((BOARD_SPEC.wheelR * 2) / skin.cell))
  const f1 = noiseField(4242 + skin.seed * 977, cells, cells)
  const f2 = noiseField(9091 + skin.seed * 977, cells * 2, cells * 2)
  paintBlobs(ctx, S, S, skin.level, (u, v) => f1(u, v) * 0.78 + f2(u, v) * 0.22)
  cv.dataset.cells = `${cells}x${cells}`

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export const BOARD_SPEC = {
  /** ความยาวทั้งแผ่น รวมปลายมนสองข้าง */
  deckLen: 0.82,
  deckWide: 0.3,
  deckThick: 0.05,
  /** ปลายเริ่มเชิดที่กี่ส่วนของครึ่งความยาว (0.5 = เชิดตั้งแต่กลางไปหาปลาย) */
  kickStart: 0.52,
  /** ปลายเชิดสูงเท่าไร เทียบความยาวทั้งแผ่น */
  kickH: 0.035,
  /** ท้องแผ่นแอ่นขึ้นตรงกลางเท่าไร เทียบความกว้าง */
  concave: 0.03,
  truckX: 0.235,
  wheelR: 0.038,
  wheelW: 0.042,
  /** ระยะจากพื้นถึงกึ่งกลางความหนาของแผ่นที่จุดกึ่งกลางบอร์ด */
  deckY: 0.105,
}

/**
 * ความสูงของ "หน้าแผ่นที่เหยียบ" จากพื้น
 *
 * ต้องคิดจาก spec ไม่ใช่ค่าคงที่ — พอเปลี่ยนความหนาแผ่นหรือความสูงจากพื้น ผู้เรียก
 * ต้องรู้ระดับใหม่ทันที ไม่งั้นเท้าจะจมหรือลอยทุกครั้งที่ปรับ
 */
export function deckTop(spec = BOARD_SPEC) {
  return spec.deckY + spec.deckThick / 2 + 0.004
}

/** ครึ่งความกว้างของแผ่นที่ตำแหน่ง x — กลางตรง ปลายเป็นครึ่งวงกลม (ทรงสเตเดียม) */
function halfWidthAt(x, len, wide) {
  const r = wide / 2
  const flat = len / 2 - r
  const a = Math.abs(x)
  if (a <= flat) return r
  const t = Math.min(1, (a - flat) / r)
  return r * Math.sqrt(Math.max(0, 1 - t * t))
}

/** ไล่ขึ้นแบบนุ่ม ไม่มีสันหัก — ใช้ทำปลายเชิด */
function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / Math.max(1e-6, b - a)))
  return t * t * (3 - 2 * t)
}

/** ระยะจากจุดถึงแกนกลางของทรงสเตเดียม — ใช้หาระยะถึงขอบแผ่นแบบแม่นยำ */
function distToSpine(x, z, len, wide) {
  const flat = len / 2 - wide / 2
  const dx = Math.max(0, Math.abs(x) - flat)
  return Math.hypot(dx, z)
}

/**
 * แผ่นบอร์ด — สร้างจาก "ระยะถึงขอบ" ไม่ใช่การกวาดหน้าตัด
 *
 * การกวาดหน้าตัดตามแกนยาวได้ปลายที่ผิด: ตรงหัวท้าย ขอบแผ่นโค้งไปทางอื่นแล้ว แต่หน้าตัด
 * ยังตั้งฉากกับแกน x อยู่ ปลายจึงออกมาเป็นลิ่มแบน ๆ ไม่ใช่จมูกมน
 *
 * ของจริงคือแผ่นหนาคงที่ที่ "ขอบถูกลบมุมด้วยรัศมีเท่าครึ่งความหนา" รอบทั้งใบ
 * เขียนตรง ๆ ได้เลยถ้าคิดจากระยะถึงขอบ: ห่างขอบเกินหนึ่งความหนา = หนาเต็ม
 * เข้าใกล้ขอบ = ม้วนลงเป็นวงกลมจนบรรจบกับผิวล่างพอดีที่ขอบ
 * ทรงสเตเดียมหาระยะถึงขอบได้แม่น (รัศมี ลบ ระยะถึงแกนกลาง) จึงไม่ต้องประมาณ
 */
function deckGeometry(
  { deckLen, deckWide, deckThick, kickStart, kickH, concave },
  nx = 140,
  nz = 26,
) {
  const pos = []
  const idx = []
  const th = deckThick / 2
  const r = deckWide / 2
  const rows = nx + 1
  const cols = nz + 1

  const surface = (sign) => {
    const base = pos.length / 3
    for (let i = 0; i <= nx; i += 1) {
      const x = (i / nx - 0.5) * deckLen
      const hw = halfWidthAt(x, deckLen, deckWide)
      const lift = kickH * deckLen * smoothstep(kickStart, 1, Math.abs(x) / (deckLen / 2))
      for (let j = 0; j <= nz; j += 1) {
        const z = (j / nz - 0.5) * 2 * hw
        // ระยะถึงขอบ แล้วแปลงเป็นความหนา ณ จุดนั้น (ม้วนลงเป็นวงกลมในช่วงสุดท้าย)
        const d = Math.max(0, r - distToSpine(x, z, deckLen, deckWide))
        const k = Math.min(1, d / Math.max(1e-6, th))
        const t = Math.sqrt(Math.max(0, 1 - (1 - k) ** 2))
        const dip = concave * deckWide * (1 - (Math.abs(z) / Math.max(1e-6, hw)) ** 2)
        pos.push(x, lift + sign * th * t - dip, z)
      }
    }
    for (let i = 0; i < nx; i += 1) {
      for (let j = 0; j < nz; j += 1) {
        const a = base + i * cols + j
        const b = a + 1
        const c = a + cols
        const dd = c + 1
        /**
         * ทิศเวียนของสามเหลี่ยม: i ไล่ตามแกน x, j ไล่ตามแกน z
         * cross(+x, +z) ชี้ลง (-y) — ผิวบนจึงต้องเวียน (a, b, c) ไม่ใช่ (a, c, b)
         * เวียนผิดทางแล้วนอร์มัลกลับด้านทั้งแผ่น แสงจะมาจากด้านหลังผิว ไล่เฉดเพี้ยนทั้งชิ้น
         */
        if (sign > 0) idx.push(a, b, c, b, dd, c)
        else idx.push(a, c, b, b, c, dd)
      }
    }
  }
  surface(1)
  surface(-1)

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  void rows
  return g
}

/**
 * แผงตรวจล้อ (dev) — ดูลายแผ่ออกเป็นแผ่นแบน + ตรวจตะเข็บ + อ่านค่าการหมุนจริง
 *
 * เป็น DOM ไม่ใช่ mesh ใน scene เพราะสิ่งที่ต้องตรวจคือ "ผ้าใบต้นทาง" ไม่ใช่ของที่วาดในฉาก:
 * ล้อกินที่จอแค่ ~40px และครึ่งลูกหันหนีกล้องเสมอ มองจากในฉากยังไงก็ไม่เห็นลายทั้งผืน
 *
 * ตะเข็บ: วาดผิวข้างต่อกันสองรอบ รอยต่อกลางภาพคือจุด u=0/1 (เส้นเหลือง) ลายที่วนรอบ
 * ถูกต้องจะอ่านไม่ออกว่าตะเข็บอยู่ไหน ถ้าเห็นรอยผ่าคือกริดสุ่มไม่ได้วนรอบ
 *
 * การหมุนอ่านจากมุมจริงของ mesh ไม่ใช่จากค่าที่สั่ง — สั่งแล้วไม่ขยับจะได้เห็นว่านิ่ง
 */
function useWheelDebug(dbg, { tread, face, spin, wheels, sk }) {
  const out = useRef(null)
  useEffect(() => {
    if (!import.meta.env.DEV || !dbg) return undefined
    const box = document.createElement('div')
    box.style.cssText =
      'position:fixed;left:12px;bottom:12px;z-index:60;display:grid;gap:6px;padding:8px;' +
      'border-radius:10px;background:#0b1418ee;color:#d8f4ff;font:11px/1.5 ui-monospace,monospace;' +
      'box-shadow:0 6px 24px #0008;pointer-events:none'
    const cv = document.createElement('canvas')
    cv.width = 512
    cv.height = 256
    cv.style.cssText = 'width:512px;image-rendering:pixelated;border-radius:6px'
    const txt = document.createElement('div')
    box.append(cv, txt)
    document.body.append(box)

    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#0b1418'
    ctx.fillRect(0, 0, cv.width, cv.height)
    // ผิวข้างสองรอบติดกัน — ตะเข็บ u=0/1 มาอยู่กลางภาพให้ตรวจได้
    ctx.drawImage(tread.image, 0, 0, 256, 64)
    ctx.drawImage(tread.image, 256, 0, 256, 64)
    ctx.strokeStyle = '#ffd34d'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(256.5, 0)
    ctx.lineTo(256.5, 64)
    ctx.stroke()
    /**
     * ฝาวาดตามสัดส่วนโลกจริง ไม่ยืดให้เต็มช่อง
     *
     * ผิวข้าง 256px แทนเส้นรอบวง (2πR) ฝาจึงต้องได้ 256·(2R)/(2πR) = 256/π ≈ 81px
     * ยืดเป็น 160px แล้วหยดบนฝาจะดูใหญ่กว่าบนผิวสัมผัสสองเท่า ทั้งที่โลกจริงเท่ากัน
     * แผงตรวจที่โกงสเกลคือแผงที่ทำให้จูนผิด
     */
    const faceSide = Math.round(256 / Math.PI)
    ctx.drawImage(face.image, 0, 84, faceSide, faceSide)
    ctx.fillStyle = '#d8f4ff'
    ctx.font = '12px ui-monospace, monospace'
    ctx.fillText('tread ×2 — เส้นเหลือง = ตะเข็บ u=0/1', 4, 74)
    ctx.fillText('face (สเกลเดียวกับผิวข้าง)', faceSide + 10, 96)

    out.current = txt
    return () => {
      out.current = null
      box.remove()
    }
  }, [dbg, tread, face])

  const next = useRef(0)
  useFrame(({ clock }) => {
    const el = out.current
    if (!el) return
    // อัปเดตข้อความ 10 ครั้ง/วินาที — เขียน DOM ทุกเฟรมคือ layout ซ้ำ 60 ครั้งฟรี ๆ
    if (clock.elapsedTime < next.current) return
    next.current = clock.elapsedTime + 0.1
    const live = wheels.current[0]
    const deg = live ? ((live.rotation.y * 180) / Math.PI).toFixed(1) : 'ไม่พบล้อ'
    const rev = (spin / (Math.PI * 2)).toFixed(3)
    el.textContent =
      `spin ${spin.toFixed(2)} rad/s = ${rev} รอบ/วิ | มุมจริงของล้อ ${deg}° | ` +
      `หยด ${sk.cell} (ช่อง ${tread.image.dataset.cells ?? '?'} / ฝา ${face.image.dataset.cells ?? '?'}) | ` +
      `ระดับตัด ${sk.level} | เมล็ด ${sk.seed}`
  })
}

/**
 * @param {object} p
 * @param {object} [p.spec] รูปทรงบอร์ด — ดู BOARD_SPEC
 * @param {number} [p.spin] ความเร็วเชิงมุมของล้อ (rad/s) 0 = หยุดนิ่ง ลบ = กลิ้งถอยหลัง
 * @param {{cell?: number, level?: number, seed?: number}} [p.skin] ลายล้อ — ดู WHEEL_SKIN
 * @param {number} [p.dbg] โหมดตรวจ (dev) — แผงดูลายแผ่ + ตะเข็บ + ค่าการหมุนจริง
 */
export function Skateboard({ spec = BOARD_SPEC, spin = 0, skin = null, dbg = 0, ...props }) {
  const S = { ...BOARD_SPEC, ...spec }
  const { deckWide, deckThick, truckX, wheelR, wheelW, deckY } = S

  const deck = useMemo(() => deckGeometry(S), [
    S.deckLen,
    S.deckWide,
    S.deckThick,
    S.kickStart,
    S.kickH,
    S.concave,
  ])
  /**
   * ล้อหมุน — เก็บ ref ไว้ตามช่องคงที่ ไม่ push เข้า array
   *
   * callback ref ถูกเรียกใหม่ทุกครั้งที่ re-render (closure ใหม่) ถ้า push จะได้ของซ้ำ
   * งอกขึ้นเรื่อย ๆ จนหมุน mesh เดิมซ้ำหลายรอบต่อเฟรม
   */
  const wheels = useRef([])
  const angle = useRef(0)
  useFrame((_, dt) => {
    if (!spin) return
    // มอดด้วย 2π กันค่าสะสมโตจนความละเอียด float หาย (ค้างเป็นวินาทีที่หลายพัน)
    angle.current = (angle.current + spin * dt) % (Math.PI * 2)
    for (const m of wheels.current) {
      /**
       * ล้อถูกพลิก [π/2, 0, 0] อยู่แล้ว ลำดับออยเลอร์ XYZ คือ Rx·Ry·Rz
       * ดังนั้น rotation.y หมุนรอบแกนของทรงกระบอกเอง = แกนเพลาพอดี
       * ไปแตะ x หรือ z คือเอียงล้อออกจากเพลา
       */
      if (m) m.rotation.y = angle.current
    }
    if (import.meta.env.DEV) window.__wheel = { spin, angle: angle.current }
  })

  const sk = { ...WHEEL_SKIN, ...skin }
  const face = useMemo(() => wheelFaceTexture(sk), [sk.cell, sk.level, sk.seed])
  const tread = useMemo(() => wheelSideTexture(sk), [sk.cell, sk.level, sk.seed])
  /**
   * ปล่อยของเก่าตอน "ลายเปลี่ยน" ด้วย ไม่ใช่แค่ตอน unmount
   *
   * ลากสไลเดอร์ลายทีเดียวสร้างผ้าใบใหม่หลายสิบใบ ถ้าปล่อยเฉพาะตอน unmount
   * texture เก่าค้างบน GPU ทั้งแถว — ผูก cleanup กับตัว texture เองจึงตรงกับอายุจริงของมัน
   */
  useEffect(() => () => face.dispose(), [face])
  useEffect(() => () => tread.dispose(), [tread])
  useDisposable([deck])
  useWheelDebug(dbg, { tread, face, spin, wheels, sk })

  return (
    <group {...props}>
      <group position={[0, deckY, 0]}>
        <mesh geometry={deck} castShadow receiveShadow>
          <meshStandardMaterial color={DECK} roughness={0.7} />
        </mesh>
      </group>

      {/* ---------- ทรัค + ล้อ ---------- */}
      {/**
       * ทรัคต้องเลื่อนลงตามท้องแผ่นที่แอ่น
       *
       * ค่า concave กดผิวทั้งบนและล่างลงตรงกลางแผ่น ทรัคยึดกับท้องแผ่นที่แนวกลางพอดี
       * ถ้าไม่เลื่อนตาม ฐานทรัคจะทะลุขึ้นมาโผล่บนหน้าแผ่น (เห็นเป็นแถบขาวบนกริป)
       */}
      {[-1, 1].map((s, si) => (
        <group key={s} position={[s * truckX, -(S.concave ?? 0) * deckWide, 0]}>
          {/* ฐานทรัคแนบใต้ท้องแผ่นพอดี — ยกสูงกว่านี้จะโผล่ทะลุหน้าแผ่นขึ้นมา */}
          <mesh position={[0, deckY - deckThick / 2 - 0.014, 0]} castShadow>
            <boxGeometry args={[0.09, 0.022, deckWide * 0.53]} />
            <meshStandardMaterial color={TRUCK} roughness={0.35} metalness={0.5} />
          </mesh>
          {/* คอทรัค: เอียงเข้าหากลางบอร์ดเหมือนของจริง ไม่ใช่แท่งตั้งฉาก */}
          <mesh
            position={[s * -0.014, (deckY - deckThick / 2 - 0.022 + wheelR) / 2 + wheelR * 0.4, 0]}
            rotation={[0, 0, s * 0.5]}
            castShadow
          >
            <boxGeometry args={[0.05, Math.max(0.02, deckY - wheelR - 0.03), deckWide * 0.33]} />
            <meshStandardMaterial color={TRUCK} roughness={0.35} metalness={0.5} />
          </mesh>
          {/* เพลา: แท่งบางพาดขวางตัวบอร์ด ยาวพ้นล้อทั้งสองข้าง */}
          <mesh position={[0, wheelR, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.009, 0.009, deckWide, 12]} />
            <meshStandardMaterial color={TRUCK} roughness={0.3} metalness={0.6} />
          </mesh>
          {/* ล้อสี่ตัว: แกนหมุนอยู่ตามแนวขวางบอร์ด (แกน z) จึงต้องพลิกทรงกระบอก 90° */}
          {[-1, 1].map((w, wi) => (
            <mesh
              key={w}
              ref={(m) => {
                wheels.current[si * 2 + wi] = m
              }}
              position={[0, wheelR, w * (deckWide * 0.38)]}
              rotation={[Math.PI / 2, 0, 0]}
              castShadow
            >
              <cylinderGeometry args={[wheelR, wheelR, wheelW, 20]} />
              {/** สามกลุ่มของทรงกระบอก: 0 = ผิวข้าง, 1/2 = ฝาสองด้าน — คนละ UV คนละลาย */}
              <meshStandardMaterial attach="material-0" map={tread} roughness={0.6} />
              <meshStandardMaterial attach="material-1" map={face} roughness={0.5} />
              <meshStandardMaterial attach="material-2" map={face} roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
