import { useEffect, useState } from 'react'
import { Logo } from '@/joespresso/Logo'
import { preloadSceneAssets } from '@/lib/preloadAssets'
import { useSceneProgress } from '@/stores/ready'
import { useNewHeroReady } from './ready'

/**
 * สปแลชของ /new-hero — บังไว้จนของโหลดครบ แล้วค่อยปล่อยให้อินโทรเล่น
 *
 * อินโทรของฉากนี้เป็นจังหวะที่นับเป็นวินาที (บานหน้าต่าง → ริบบิ้น → ตัวละคร) ถ้าปล่อยให้
 * เริ่มตั้งแต่หน้ายังโหลด GLB และคอมไพล์ shader อยู่ คนดูจะพลาดครึ่งแรกไปเลย — เฟรมแรก ๆ
 * กินเวลาเป็นวินาที ทั้งที่นาฬิกาเดินไปแล้ว (นาฬิกาตัดเพดาน dt ไว้ก็จริง แต่ช่วยได้แค่ไม่ให้
 * กระโดด ไม่ได้ทำให้มีเฟรมให้ดู)
 *
 * รอสองอย่าง ไม่ใช่อย่างเดียว:
 *   1. ไบต์ของไฟล์ฉาก — วัดจริงจาก preloadSceneAssets (แถบที่เห็นคือสัดส่วนไบต์)
 *   2. ฉากรายงานว่าวาดได้จริง (useNewHeroReady) — ตัวละครขึ้นครบ, สั่งคอมไพล์ shader
 *      ทั้งฉากจบ, และเฟรมเดินเป็นปกติแล้ว ช่วงนี้วัดเป็นสัดส่วนไม่ได้ แถบจึงค้างเต็มรอ
 */

/** วินาทีที่ยอมรอ ก่อนจะเปิดให้ดูทั้งที่ยังไม่ได้สัญญาณ — กันหน้าค้างถ้ามีอะไรพัง */
const GIVE_UP_AFTER = 12000
/** ความยาวของการจางออก (ต้องตรงกับ transition ใน style ข้างล่าง) */
const FADE_MS = 420

export function NewHeroSplash({ onDone }: { onDone: () => void }) {
  const progress = useSceneProgress()
  const ready = useNewHeroReady()
  const [leaving, setLeaving] = useState(false)

  // ดึงไฟล์ฉากเองตั้งแต่เฟรมแรก — ไม่ต้องรอ chunk ของฉากโหลดเสร็จก่อนถึงจะเริ่มวัด
  useEffect(() => {
    void preloadSceneAssets()
  }, [])

  // ฉากพร้อมแล้ว = เริ่มจางออก
  useEffect(() => {
    if (ready) setLeaving(true)
  }, [ready])

  // ยอมเปิดให้ดูทั้งที่ยังไม่ได้สัญญาณ ถ้ารอนานเกินไป — กันหน้าค้างถ้ามีอะไรพัง
  useEffect(() => {
    const id = setTimeout(() => setLeaving(true), GIVE_UP_AFTER)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!leaving) return undefined
    const id = setTimeout(onDone, FADE_MS)
    return () => clearTimeout(id)
  }, [leaving, onDone])

  const pct = Math.round(progress * 100)

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#265ada]"
      style={{
        opacity: leaving ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      <div className="flex flex-col items-center gap-6">
        <Logo width={104} height={36} color="#ffffff" className="" />
        {/* แถบคือสัดส่วนไบต์จริง — เต็มแล้วค้างรอ shader คอมไพล์ ไม่มีตัวเลขปลอมวิ่งต่อ */}
        <div className="h-[3px] w-[180px] overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${pct}%`, transition: 'width 200ms linear' }}
          />
        </div>
      </div>
    </div>
  )
}
