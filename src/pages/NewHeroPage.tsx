import { Suspense, lazy, useEffect, useState } from 'react'
import './portfolio2026final.css'
import { Logo } from '@/joespresso/Logo'
import { NewHeroSplash } from '@/newhero/NewHeroSplash'
import { holdIntro, releaseIntro } from '@/newhero/intro'
import { resetNewHeroReady } from '@/newhero/ready'
import heroLife from '@/assets/v2final/hero-life.svg'
import heroBubble from '@/assets/v2final/hero-ideas-bubble.svg'

/**
 * /new-hero — hero ตัวใหม่ (คอมพ์ 12739:158699)
 *
 * เลย์เอาต์: พื้นน้ำเงิน · แถบหน้าต่างสามมิติกินครึ่งซ้าย · ข้อความอยู่ครึ่งขวา
 * ตัวหนังสือกับสัดส่วนยกมาจากหน้า /2026-final ทั้งชุด (คลาส v3-*) — เป็นหัวเรื่องเดียวกัน
 * เปลี่ยนแค่ฝั่งที่วางกับสีพื้น จึงไม่ปั้นสไตล์ชุดใหม่ให้ต้องมาไล่ให้ตรงกันทีหลัง
 *
 * มี shell ของตัวเอง (ไม่ผ่าน NavBar/Footer ของเว็บ) เพราะฉากกินเต็มวิวพอร์ต และตัวห่อ
 * ของเลย์เอาต์หลักมี transform ซึ่งทำให้ fixed ในหน้าลูกอ้างอิงตัวห่อแทนวิวพอร์ต
 */
const NewHeroScene = lazy(() => import('@/newhero/NewHeroScene'))
const CameraTuner = lazy(() =>
  import('@/newhero/CameraTuner').then((m) => ({ default: m.CameraTuner })),
)

/** เมนูตามคอมพ์ — ยังไม่มีปลายทาง หน้าอื่นของชุดนี้ยังไม่ถูกทำ */
const MENU = ['About', 'Experiences', 'Works', 'Contact']

export function NewHeroPage() {
  /**
   * กั้นอินโทรไว้จนสปแลชปิด แล้วอินโทรจะได้เริ่มนับหนึ่งตอนคนดูเห็นฉากจริง ๆ
   *
   * กั้นใน effect และกั้น "ทุกครั้งที่ effect ถูกติด" ไม่ใช่ครั้งเดียวตอน mount — StrictMode
   * ในโหมด dev ถอด effect ทิ้งแล้วใส่กลับทันทีหลัง mount ระหว่างนั้น cleanup ข้างล่างเรียก
   * releaseIntro ไปแล้ว ถ้าไม่กั้นซ้ำ นาฬิกาจะวิ่งอยู่หลังสปแลชจนอินโทรจบก่อนสปแลชเปิด
   */
  const [splash, setSplash] = useState(true)
  useEffect(() => {
    if (splash) holdIntro()
  }, [splash])
  useEffect(
    () => () => {
      // ออกจากหน้าไปกลางคันตอนสปแลชยังค้าง = ปล่อยธงทิ้งไว้ อินโทรของรอบหน้าจะไม่มีวันเริ่ม
      releaseIntro()
      // เข้ามาใหม่ต้องรอฉากใหม่คอมไพล์อีกรอบ ไม่ใช่ผ่านฉลุยเพราะธงเก่าค้างอยู่
      resetNewHeroReady()
    },
    [],
  )
  return (
    <main className="v3 relative h-svh w-full overflow-hidden bg-[#5cb8ee] text-[#16222c]">
      <style>{`
        /* หัวเรื่องหน้านี้แคบกว่าของ /2026-final เพราะแบ่งครึ่งจอให้ฉากสามมิติ
           ใช้สเกลของตัวเองแทนคลาส v3-h1 ที่คิดมาสำหรับบล็อกที่กว้างกว่านี้ */
        .nh-h1 {
          font-family: var(--v3-display);
          font-size: clamp(28px, min(4.6vw, 6.6svh), 68px);
          line-height: 1;
          letter-spacing: -0.01em;
        }
      `}</style>

      {import.meta.env.DEV && (
        <style>{`
          /* "กรอบ ref" ในแผงปรับกล้อง — ครอบเวทีให้เป็นอัตราส่วนเดียวกับคอมพ์ 1440x1024
             fov คุมแกนตั้ง อัตราส่วนต่างกันนิดเดียวตำแหน่งแนวนอนก็เลื่อน เทียบกับ ref ไม่ได้ */
          html[data-newhero-crop='on'] #newhero-stage {
            inset: auto;
            position: relative;
            height: auto;
            width: auto;
            aspect-ratio: 1440 / 1024;
            max-height: 100svh;
            max-width: 100vw;
            outline: 1px solid rgba(255, 255, 255, 0.25);
          }
          html[data-newhero-crop='on'] main.v3 {
            display: grid;
            place-items: center;
          }
        `}</style>
      )}

      <div id="newhero-stage" className="absolute inset-0">
        <Suspense fallback={null}>
          <NewHeroScene />
        </Suspense>
      </div>

      <header className="relative z-10 flex items-center justify-between px-[clamp(24px,4.7vw,68px)] pt-[clamp(24px,5.5svh,56px)]">
        <Logo width={80} height={28} color="#16222c" className="shrink-0" />
        <nav className="flex items-center gap-[clamp(16px,2.2vw,32px)] text-[15px] font-medium">
          {MENU.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </nav>
      </header>

      {/**
       * บล็อกข้อความชิดขวา กว้างราวหนึ่งในสามของจอตามคอมพ์ (x 986→1390 ของ 1440)
       * pointer-events ปิดไว้ทั้งชั้น ฉากข้างหลังจึงยังรับเมาส์ได้เต็มพื้นที่
       */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-end pr-[clamp(24px,4.7vw,68px)] pl-[66%] text-[var(--v3-hero-ink)]">
        <div className="flex w-full flex-col gap-[clamp(10px,2.6svh,26px)]">
          <p className="nh-h1">Bring your</p>
          <div className="flex items-start gap-[clamp(10px,1.7vw,24px)]">
            <p className="nh-h1">Ideas</p>
            <img
              src={heroBubble}
              alt=""
              className="mt-[0.12em] h-[clamp(26px,5.2svh,54px)] w-auto"
            />
          </div>
          <div className="flex items-end gap-[clamp(10px,1.7vw,24px)]">
            <p className="nh-h1">to</p>
            {/* LIFE เป็นตัวอักษรที่ถูกวาดเป็นรูปในแบบ ไม่ใช่ข้อความ — ยกไฟล์เดิมมาใช้ */}
            <img src={heroLife} alt="LIFE" className="h-[clamp(26px,5.2svh,54px)] w-auto" />
          </div>
          <p className="mt-[clamp(4px,1.4svh,14px)] text-[16px] leading-normal">
            I love crafting valuable things with passionate people
            <br />
            to bringing design to a real-world impact solution.
          </p>
        </div>
      </div>

      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <CameraTuner />
        </Suspense>
      )}

      {splash && (
        <NewHeroSplash
          onDone={() => {
            setSplash(false)
            releaseIntro()
          }}
        />
      )}
    </main>
  )
}
