import { setSceneProgress } from '@/stores/ready'

/**
 * ไฟล์ของฉากที่ต้องโหลดจริง ๆ — แถบโหลดวัดจากไบต์ของไฟล์พวกนี้
 *
 * ดึงเองด้วย fetch แบบสตรีมแทนที่จะรอ loader ของ three เพราะ:
 *  - LoadingManager รายงานเป็น "จำนวนไฟล์" ไม่ใช่ไบต์ ฉากนี้มีไฟล์เดียว แถบจะกระโดด 0 -> 100
 *  - ต้องเริ่มวัดได้ตั้งแต่ก่อน chunk ของฉากจะโหลดเสร็จ ซึ่งตอนนั้น loader ยังไม่มีตัวตน
 *
 * ของที่ดึงมาไม่ได้ถูกใช้ต่อโดยตรง — มันไปนั่งอยู่ใน HTTP cache แล้ว useGLTF ค่อยหยิบไป
 * (คำขอที่สองไม่วิ่งออกเน็ต) ผลพลอยได้คือฉากพร้อมเร็วขึ้นเพราะเริ่มดึงตั้งแต่เฟรมแรก
 */
export const SCENE_ASSETS = ['/mascot.glb']

/**
 * ดาวน์โหลดไฟล์ทั้งชุดพร้อมรายงานความคืบหน้าเป็นสัดส่วนของไบต์
 *
 * ถ้าเซิร์ฟเวอร์ไม่ส่ง content-length (ส่งแบบ chunked) ไฟล์นั้นไม่มีตัวหาร — นับเป็น
 * หนึ่งหน่วยที่เสร็จตอนอ่านจบ ไม่เดาขนาดขึ้นมาเอง
 */
export async function preloadSceneAssets(urls: readonly string[] = SCENE_ASSETS) {
  const sizes: number[] = Array.from({ length: urls.length }, () => 0)
  const got: number[] = Array.from({ length: urls.length }, () => 0)
  const done: boolean[] = Array.from({ length: urls.length }, () => false)

  const report = () => {
    const known = sizes.reduce((a, b) => a + b, 0)
    const unknown = sizes.filter((s) => s === 0).length
    const readBytes = got.reduce((a, b, i) => (sizes[i] > 0 ? a + b : a), 0)
    const doneUnknown = done.filter((d, i) => d && sizes[i] === 0).length
    const total = known + unknown
    if (total <= 0) return
    setSceneProgress((readBytes + doneUnknown) / total)
  }

  await Promise.all(
    urls.map(async (url, i) => {
      try {
        const res = await fetch(url)
        const len = Number(res.headers.get('content-length'))
        sizes[i] = Number.isFinite(len) && len > 0 ? len : 0
        report()
        const body = res.body
        if (!body) {
          await res.arrayBuffer()
        } else {
          const reader = body.getReader()
          for (;;) {
            const { done: end, value } = await reader.read()
            if (end) break
            got[i] += value.byteLength
            report()
          }
        }
      } catch {
        // โหลดไม่ได้ก็ไม่ควรค้างแถบไว้ — ปล่อยให้ตัวนับเดินต่อ แล้ว timeout ของสปแลชจัดการเอง
      }
      done[i] = true
      report()
    }),
  )
}
