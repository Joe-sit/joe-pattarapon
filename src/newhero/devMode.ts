/**
 * โหมดของหน้า: design (ตั้งต้น) ↔ dev — สวิตช์ในฉาก hero (./Switch) สลับ
 *
 *   dev = ธีมมืด (CameraFX ย้อมทั้งฉากเป็นกลางคืน · พื้นหน้ารอบการ์ดมืดตาม) + แว่น MLG 8-bit บนหน้าตัวละคร (Mascot)
 *
 * เก็บเป็นค่าระดับโมดูล ไม่ผ่าน React — ทุกชิ้นอ่านในลูปเฟรมของตัวเอง (ไม่ re-render ทั้งฉากตอนสลับ)
 * ติด data-mode ที่ <html> ให้ CSS ใช้ได้ด้วย
 */
type Listener = () => void
const listeners = new Set<Listener>()

export const devMode = {
  on: false,
  /** เวลาที่สลับล่าสุด (ms ของ performance.now) */
  at: -1e9,
  /** ค่าธีมตอนสลับ — สลับกลางทางแล้วไล่ต่อจากค่าปัจจุบัน ไม่กระโดด */
  from: 0,
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (x: number) => {
  const u = clamp01(x)
  return u * u * (3 - 2 * u)
}
const since = () => (performance.now() - devMode.at) / 1000

/** ความเป็น dev ของธีม 0..1 (ไล่นุ่มราว 0.7 วิ) */
export function devK() {
  const target = devMode.on ? 1 : 0
  return devMode.from + (target - devMode.from) * smooth(since() / 0.7)
}

/** ปุ่มสวิตช์ 0 = design (ขวา) → 1 = dev (ซ้าย) — เด้งเลยนิดตอนสุดทาง */
export function devKnob() {
  const u = clamp01(since() / 0.38)
  const c = 1.7
  const e = u >= 1 ? 1 : 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2
  return devMode.on ? e : 1 - e
}

/**
 * แว่น 0 = ไม่ใส่ (ลอยพ้นหัว) · 1 = ใส่ — เข้า dev: หล่นลงมาจากด้านบนแล้วเด้งนิด (deal with it)
 * ออก: ยกขึ้นเร็ว ๆ
 */
export function devGlasses() {
  const s = since()
  if (devMode.on) {
    const u = clamp01((s - 0.12) / 0.55)
    if (u <= 0) return 0
    const c = 2.2
    return 1 + (c + 1) * (u - 1) ** 3 + c * (u - 1) ** 2
  }
  return devMode.at < 0 ? 0 : 1 - smooth(s / 0.3)
}

export function toggleDevMode() {
  devMode.from = devK()
  devMode.on = !devMode.on
  devMode.at = performance.now()
  if (typeof document !== 'undefined') document.documentElement.dataset.mode = devMode.on ? 'dev' : 'design'
  listeners.forEach((l) => l())
}

export function subscribeDevMode(l: Listener) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
