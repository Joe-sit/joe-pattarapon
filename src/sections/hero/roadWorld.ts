import { DEVICE, ROLO_STORY, smooth, worksPost } from './workMotion'

/**
 * เรื่องถนน (POST_CODE = 'road' ใน ./workMotion) — ตาม GIF ref (มือถือ → ไอคอนแอป → หลังคา → ถนน) ใช้ร่วมสามแคนวาส:
 *   ./BubbleTraveler  ตัวเครื่องแก้ว: ดันเข้าหาไอคอนแอปจนไอคอนเต็มกลางจอ (dolly)
 *   ./RoadHome        จอเครื่องกลายเป็นหน้าโฮม: wallpaper ไล่ฟ้า ช่องแอปใส ไอคอนแอปเดียว = favicon ของเว็บ
 *   ./RoadStage       ไอคอนหลุดเป็นแผ่นหนา หงายราบเป็นหลังคา เสาขาวคาดแดงงอกลงพื้น → กล้องโฉบลงระดับพื้น → เคลื่อนไปตามถนน
 *                     ป้ายผลงานเรียงริมทาง
 *
 * จังหวะ (worksPost — ติดลบ = ยังอยู่ในบท Code) [เริ่ม, ยาว]:
 *   HOME   ของบนจอเครื่องจางเป็นหน้าโฮม · ฉาก Code มืดจางเป็นพื้นสว่าง
 *   DOLLY  ช้าแล้วเร่ง: ดันเข้าหาไอคอน จนไอคอนกว้าง ICON_PX กลางจอ → ตัดไปแผ่นไอคอนในแคนวาสถนน (ทาบกันพอดี)
 *   FLIP   แผ่นไอคอนหงายราบเป็นหลังคา เผยใต้หลังคา · เสางอกลง · โลกถนนโผล่รอบ ๆ
 *   SWOOP  กล้องโฉบลอดข้างหลังคาลงระดับพื้น เอียงแล้วตั้งตรง
 *   DRIVE  สกรอลล์ = เคลื่อนไปตามถนน ผ่านป้ายผลงานทีละชิ้น
 *   OUT    ย้อนทางเดิม: กลับขึ้นหลังคา แผ่นตั้งกลับเป็นไอคอน ตัดกลับเครื่อง ถอยออกเป็นจอโฮม → ของบนจอเดิม (ต้นบท Ship)
 */
export const ROAD_HOME = [-0.62, 0.18] as const
export const ROAD_DOLLY = [-0.4, 0.48] as const
export const ROAD_FLIP = [0.1, 0.32] as const
export const ROAD_SWOOP = [0.32, 0.42] as const
export const ROAD_DRIVE = [0.78, 2.0] as const
export const ROAD_BACK = [2.06, 0.18] as const
export const ROAD_UNDOLLY = [2.25, 0.15] as const

/**
 * เรื่อง rolodex (./RolodexStage) ใช้ต้นเรื่องเดียวกัน แต่เครื่องพุ่งชนคำ Code ก่อน (CODE_HIT ≈ worksPost −0.5)
 * หน้าโฮม/ดันเข้าไอคอนต่อจากแรงชนทันที (เครื่องไหลเข้าหากล้องทางเดียว) · ถอยออกหลังสำรับหุบ
 */
const HOME = ROLO_STORY ? ([-0.4, 0.16] as const) : ROAD_HOME
/* rolodex: เริ่มดันทันทีหลังแรงชน (ช้าแล้วเร่ง ต่อจากแรงพุ่งที่ค่อย ๆ หมด) — เครื่องไม่หยุดนิ่งระหว่างชนกับเข้าไอคอน */
export const DOLLY = ROLO_STORY ? ([-0.42, 0.8] as const) : ROAD_DOLLY
/* rolodex: ถอยออกหลังช่วง Selected Projects (./RolodexStage — ตัดกลับหน้าโฮมที่ 2.26) ให้เสร็จก่อนบท Ship */
const UNDOLLY = ROLO_STORY ? ([2.28, 0.14] as const) : ROAD_UNDOLLY

/** ไอคอนบนหน้าโฮม (หน่วยท้องถิ่นของเครื่อง · px ขนาดตั้งต้น): กลาง x y · ด้าน */
export const HOME_ICON = { x: 0, y: DEVICE.hh - 74, s: 46 }
/** ไอคอนกลางจอตอนตัด (× ความสูงจอ) · rolodex หยุดที่ขนาดไอคอนในคลิป ref (~21% ของจอ) — ปึกกางแล้วโต 3 เท่า */
export const ICON_PX = ROLO_STORY ? 0.21 : 0.42

const at01 = (x: number, r: readonly [number, number]) => Math.min(1, Math.max(0, (x - r[0]) / r[1]))

/**
 * ท่าของเรื่องถนน ณ ความคืบหน้าตอนนี้
 *   home  0→1  จอเครื่องเป็นหน้าโฮม
 *   dolly 0→1  ดันเข้าหาไอคอน (1 = ตัดไปแคนวาสถนน)
 *   flip  0→1  ไอคอนหงายเป็นหลังคา
 *   swoop 0→1  กล้องโฉบลงพื้น
 *   drive 0→1  ไปตามถนน
 */
export function roadPhase(b: { code: number; works: number }) {
  const post = worksPost(b)
  const back = smooth(at01(post, ROAD_BACK))
  const undolly = at01(post, UNDOLLY)
  const keep = 1 - back
  const dk = at01(post, DOLLY)
  return {
    post,
    home: smooth(at01(post, HOME)) * (1 - smooth((undolly - 0.6) / 0.4)),
    /* ช้าแล้วเร่ง (แบบ GIF: ดันช้า ๆ แล้วพุ่ง) · ถอยออกแบบกลับกัน */
    dolly: Math.min(dk * dk * (1.6 - 0.6 * dk), 1) * (1 - smooth(undolly)),
    flip: smooth(at01(post, ROAD_FLIP)) * keep,
    swoop: smooth(at01(post, ROAD_SWOOP)) * keep,
    drive: at01(post, ROAD_DRIVE) * keep,
  }
}

/** ตอนนี้แคนวาสถนนคุมภาพอยู่ (ตัวเครื่อง/ของบนจอซ่อน) */
export const roadCut = (ph: { dolly: number }) => ph.dolly >= 0.999
