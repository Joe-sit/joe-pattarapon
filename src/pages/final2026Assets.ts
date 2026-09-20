import { JOURNEY } from '@/data/journey'
import heroBubble from '@/assets/v2final/hero-ideas-bubble.svg'
import heroLife from '@/assets/v2final/hero-life.svg'
import { preloadSceneAssets } from '@/lib/preloadAssets'

/**
 * ไฟล์ทุกไฟล์ที่ /2026-final ต้องมี — ด่านโหลดของหน้านี้วัดจากไบต์ของชุดนี้
 *
 * ทำไมต้องมีรายการ ไม่ปล่อยให้แต่ละชิ้นโหลดของตัวเองตอนถึงคิว: ของพวกนี้โผล่กลางการเลื่อน
 * (รูปมือตอนปิดจอ "สิ่งที่ทำ", รูปพอร์เทรตในรอยสาด, โลโก้ในไทม์ไลน์) คนดูที่เลื่อนเร็วกว่า
 * เน็ตจะเห็นช่องว่างแล้วรูปกระโดดเข้ามาทีหลัง — ซึ่งเป็นจังหวะที่ออกแบบไว้แล้วพัง
 *
 * ของที่ดึงมาไม่ได้ถูกใช้ต่อโดยตรง มันไปนั่งใน HTTP cache แล้วคนใช้จริง (useGLTF,
 * SVGLoader, <img>, WebGL texture) ค่อยหยิบไป — คำขอที่สองไม่วิ่งออกเน็ต
 *
 * รูปของไทม์ไลน์ดึงจาก JOURNEY เอง ไม่ได้พิมพ์ path ซ้ำ: เพิ่มช่วงใหม่ในข้อมูลแล้วด่านโหลด
 * รู้จักรูปของมันทันที ไม่ต้องมาแก้ที่นี่อีก
 */
const JOURNEY_IMAGES = JOURNEY.flatMap((s) => [
  ...(s.logos ?? []).map((l) => l.src),
  ...(s.photo ? [s.photo.src] : []),
])

export const FINAL_ASSETS: readonly string[] = [
  /* ฉาก 3D ของจอแรก — ตัวละคร รองเท้า และแขน lumberjack (ดู joespresso/scene/Mascot) */
  '/mascot.glb',
  '/models/stylized_cartoon_shoes.glb',
  '/models/cartoon-lumberjack-arms.glb',
  /* ลูกศรกับมือชี้ของเคอร์เซอร์นำสายตา (ดู newhero/Cursor) */
  '/models/cursor-3d.glb',
  /* ฟอนต์ที่หัวเรื่องสามมิติปั้นเป็นทรง — ไม่ใช่ฟอนต์ของหน้า (ดู sections/hero/Headline3D) */
  '/fonts/momo-trust-display.json',
  /* งานลายเส้นในจอแรก โหลดด้วย SVGLoader แล้วอัดเป็นทรง */
  heroLife,
  heroBubble,
  /* รูปพอร์เทรตของรอยสาด และมือของท่าปิดจอ "สิ่งที่ทำ" */
  '/photos/joe-portrait.jpg',
  '/art/adam-hand.png',
  ...JOURNEY_IMAGES,
]

/** ไฟล์ที่ต้องถอดรหัสเป็นบิตแมปให้เสร็จ ไม่ใช่แค่มีไบต์ในแคช */
const RASTER = /\.(png|jpe?g|webp|avif)$/i

/**
 * โหลดทุกอย่างให้พร้อมใช้จริง — ไบต์ครบ + รูปถอดรหัสแล้ว + ฟอนต์ของหน้าพร้อม
 *
 * ไบต์ครบไม่เท่ากับพร้อม: `<img>` กับ texture ของ WebGL ยังต้องถอดรหัส JPEG/PNG ซึ่งกิน
 * main thread เป็นสิบมิลลิวินาทีต่อรูป ถ้าไปเกิดตอนคนดูเลื่อนอยู่ก็คือเฟรมตก — `decode()`
 * ย้ายงานนั้นมาอยู่ในด่านโหลด (เบราว์เซอร์เก็บบิตแมปที่ถอดแล้วไว้ใช้ตอนวาดจริง)
 *
 * ฟอนต์รออยู่ในด่านเดียวกัน เพราะหัวเรื่องของหน้าวัดความกว้างตัวอักษรตอน mount — วัดด้วย
 * ฟอนต์สำรองแล้วผังเลื่อนตอนฟอนต์จริงมาถึง
 */
/**
 * ก้อนโค้ดที่หน้านี้โหลดตอนถึงคิว (lazy) — ดึงมาไว้ก่อนตอนยังอยู่ในด่านโหลด
 *
 * ของพวกนี้เป็นฉาก 3D กับชั้นเชดเดอร์ที่ mount ตอนเลื่อนถึง ถ้าไม่ดึงไว้ คนดูที่เลื่อนเร็ว
 * กว่าเน็ตจะเจอจอว่างรอ chunk แล้วฉากโผล่มาทีหลัง — โหลดที่นี่ทั้ง chunk และผลข้างเคียงของ
 * มันด้วย (โมดูลตัวละครสั่ง `useGLTF.preload` ของตัวเองตอนถูกโหลด)
 *
 * import() ของ chunk ที่โหลดแล้วไม่วิ่งซ้ำ — ตอนถึงคิวจริงจึงได้ของจากแคชของ bundler
 */
const CHUNKS = [
  () => import('@/newhero/NewHeroScene'),
  () => import('@/newhero/HeroRider'),
  () => import('@/sections/whatidocard/CardStage'),
  () => import('@/sections/whatidocard/SplashReveal'),
]

export async function preloadFinalAssets() {
  await Promise.all([
    preloadSceneAssets(FINAL_ASSETS),
    ...CHUNKS.map((load) =>
      load().catch(() => {
        /* chunk เดียวพลาดไม่ควรค้างด่านทั้งหน้า — ถึงคิวมันจะลองโหลดเองอีกที */
      }),
    ),
  ])
  await Promise.all(
    FINAL_ASSETS.filter((u) => RASTER.test(u)).map(async (url) => {
      try {
        const img = new Image()
        img.src = url
        await img.decode()
      } catch {
        /* ถอดรหัสไม่ได้ก็ไม่ควรค้างด่านไว้ — ของชิ้นนั้นจะไปโหลดเองตอนถึงคิวตามเดิม */
      }
    }),
  )
  try {
    await document.fonts.ready
  } catch {
    /* เบราว์เซอร์ที่ไม่มี Font Loading API — ไม่ต้องรอ */
  }
}
