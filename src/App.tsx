import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router'
import Lenis from '@studio-freight/lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// ScrollTrigger คือตัวขับ scroll animation ของทั้งเว็บ (หน้า /joespresso อ่านผ่านมัน)
gsap.registerPlugin(ScrollTrigger)
import { SplashScreen } from '@/components/SplashScreen'
import { JoeSplash } from '@/components/JoeSplash'
import { JoeLettersSplash } from '@/components/JoeLettersSplash'
import { IntroSequence } from '@/components/IntroSequence'
import { NavBar } from '@/components/NavBar'
import { ThemePicker } from '@/components/ThemePicker'
import { AnchorNav } from '@/components/AnchorNav'
import { HomePage } from '@/pages/HomePage'
import { DriftWallSandbox } from '@/pages/DriftWallSandbox'
import { IntroSandbox } from '@/pages/IntroSandbox'
import { MascotPage } from '@/pages/MascotPage'
import { NotPortedPage } from '@/pages/NotPortedPage'
import { Portfolio2026Page } from '@/pages/Portfolio2026Page'
import { Portfolio2026FinalPage } from '@/pages/Portfolio2026FinalPage'
import { NewHeroPage } from '@/pages/NewHeroPage'
// ฉาก 3D หนัก (three.js) — lazy แยก chunk ไม่ถ่วงหน้าอื่น
const JoespressoPage = lazy(() => import('@/joespresso/Page'))
// workspace ปั้นทรง toolbar ของฉาก joespresso — ใช้ three เหมือนกัน แยก chunk เช่นกัน
const ToolbarWorkspace = lazy(() => import('@/joespresso/ToolbarWorkspace'))
const CheckerScene = lazy(() => import('@/joespresso/CheckerScene'))
import { SITE } from '@/config/site'
import { setEyeOpen, setIntroDone } from '@/stores/intro'
import { useSceneReady } from '@/stores/ready'
import { startIntro } from '@/joespresso/intro'
import { useT } from '@/i18n/store'

function Footer() {
  const t = useT()
  return (
    <footer className="mt-16 w-full bg-paper pb-16 text-center">
      <div className="border-t border-ink/10 px-6">
        <p className="mt-6 text-sm text-ink-muted">
          {t('footer.credit', { name: SITE.name, year: SITE.copyrightYear })}
        </p>
      </div>
    </footer>
  )
}

/**
 * สวิตช์สปแลช — ปิดชั่วคราวได้โดยเปลี่ยนเป็น false (เคยปิดไว้ช่วง 2026-08-23 ตอนไล่ทำ what-i-do)
 * ปิดเมื่อไรต้องเปิดประตูเองสองอย่าง: intro ของฉาก 3D (startIntro) กับ gate ของหน้า (setIntroDone)
 * ไม่งั้นพาดหัว/eyebrow ที่รอสัญญาณ "สปแลชจบ" จะไม่โผล่เลย
 * และตัวคืนตำแหน่ง scroll ตอน reload จะทำงานเฉพาะตอนปิดสปแลชเท่านั้น
 */
/** สัญญาณว่า "คนดูขยับหน้าเอง" — ใช้เลิกบังคับตำแหน่ง scroll หลังสปแลชจบ */
const MOVE_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const

const SPLASH_ON = true

export function App() {
  const [showSplash, setShowSplash] = useState(SPLASH_ON)
  // ฉาก 3D ของ joespresso รายงานตัวเองว่าโหลด+compile เสร็จ — สปแลชรออันนี้
  const sceneReady = useSceneReady()
  const location = useLocation()
  // ครอบหน้าลูกด้วย (/joespresso/toolbar) — กลุ่มนี้มี layout ของตัวเอง ไม่ใช้ shell ของเว็บ
  const isJoespresso = location.pathname.startsWith('/joespresso')
  // เวอร์ชันสองของหน้าแรก (layout ตาราง) — มี header ของตัวเอง ไม่ใช้ NavBar/Footer ของ shell
  const isV2 = location.pathname === '/2026'
  /** หน้าเวอร์ชันตัดสินแล้ว ถอดจาก Figma — มี shell ของตัวเอง ไม่ใช้ nav ของเว็บ */
  const isV3 = location.pathname === '/2026-final'
  /** หน้าเปล่าสำหรับทดลอง hero ตัวใหม่ — shell ของตัวเองเหมือนกัน (ดู NewHeroPage) */
  const isNewHero = location.pathname === '/new-hero'
  /**
   * หน้าส่องอินโทรเดี่ยว ๆ (dev เท่านั้น)
   *
   * ต้องอยู่ชั้นเดียวกับ /joespresso คือมี shell ของตัวเอง ไม่ใช่ route ข้างในเลย์เอาต์หลัก
   * เพราะอินโทรเป็น fixed inset-0 แต่ตัวห่อของเลย์เอาต์มี transform อยู่ กรอบอ้างอิงของ
   * fixed เลยกลายเป็นตัวห่อนั้นแทนที่จะเป็นวิวพอร์ต แคนวาสจึงถูกบีบเหลือแถบบาง ๆ
   * และต้องกันสปแลชของเว็บไม่ให้ขึ้นทับด้วย ไม่งั้นมีอินโทรสองตัวซ้อนกัน
   */
  const isIntroLab = import.meta.env.DEV && location.pathname === '/sandbox/intro'

  // Which splash plays is decided by where the visitor landed, not by where
  // they are now — it runs once, on load, and reading `location` live would
  // swap it mid-animation the moment they navigated.
  const [landedOn] = useState(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname,
  )
  /**
   * กั้นไม่ให้ฉาก 3D เริ่ม mount จนกว่าตัวอักษรจะเล่นจบ
   *
   * โหลดพร้อมกันแล้วแอนิเมชันกระตุกหนัก — การแตก GLB, ปั้น geometry ของ mascot
   * และ compile shader ทำบน main thread ทั้งหมด rAF ของ gsap เลยโดนอด
   * ยอมให้รวมเวลานานขึ้นแทน เพื่อให้ช่วงที่คนดูจ้องอยู่ลื่นจริง
   *
   * กั้นเฉพาะตอนเปิดเว็บมาลงที่ /joespresso — เดินเข้ามาทีหลังไม่เกี่ยว
   */
  // /2026 ฝังฉาก 3D ใบเดียวกัน — ใช้สปแลช/การกั้น mount ชุดเดียวกับ /joespresso
  // ยกเว้น /joespresso/checker: ฉากทดลองไม่มี IntroClock — สปแลชที่รอ introState จะค้างกลางทาง
  const landedOn3D =
    (landedOn.startsWith('/joespresso') && landedOn !== '/joespresso/checker') ||
    landedOn === '/2026'
  /**
   * ฉากถูก mount ทันที ไม่รอสปแลช
   *
   * เดิมกั้นไว้เพราะตัวอักษรเล่นก่อนแล้วการ mount ฉากไปแย่ง main thread จนกระตุก
   * ตอนนี้ลำดับกลับกัน: แถบโหลดขึ้นก่อน (ถูก ๆ ไม่กินแรง) แล้วตัวอักษรค่อยเล่น
   * "หลัง" โหลดเสร็จ — ถ้ายังกั้นอยู่ ฉากจะไม่เริ่มโหลดจนกว่าตัวอักษรจะจบ
   * ซึ่งรอสัญญาณโหลดเสร็จอีกที = ค้างกันเอง
   */

  useEffect(() => {
    if (SPLASH_ON) return
    startIntro()
    setIntroDone()
  }, [])

  /**
   * ปิดสปแลชอยู่ = reload แล้วต้องอยู่ที่เดิม
   *
   * ใช้ sessionStorage ไม่พึ่ง scroll restoration ของเบราว์เซอร์: หน้านี้สูงขึ้นเรื่อย ๆ
   * ระหว่างที่ chunk 3D/lazy ทยอย mount เบราว์เซอร์คืนตำแหน่งตั้งแต่ตอนหน้ายังเตี้ย
   * แล้วโดน clamp ลงมาที่ก้นหน้าเก่า — คืนเองทีหลังแล้วย้ำอีกรอบตอนความสูงนิ่งจึงตรงกว่า
   */
  useEffect(() => {
    if (SPLASH_ON) return
    const KEY = 'v2:scroll'
    const save = () => sessionStorage.setItem(KEY, String(window.scrollY))
    const want = Number(sessionStorage.getItem(KEY) ?? 0)
    let timers: ReturnType<typeof setTimeout>[] = []
    if (want > 0) {
      const put = () => {
        window.scrollTo(0, want)
        lenisRef.current?.scrollTo(want, { immediate: true })
      }
      put()
      // ย้ำตอน chunk หนัก ๆ ลงที่แล้ว — ครั้งเดียวไม่พอ ความสูงยังขยับอยู่
      timers = [300, 900, 1800].map((ms) => setTimeout(put, ms))
    }
    window.addEventListener('scroll', save, { passive: true })
    window.addEventListener('beforeunload', save)
    return () => {
      for (const t of timers) clearTimeout(t)
      window.removeEventListener('scroll', save)
      window.removeEventListener('beforeunload', save)
    }
  }, [])

  /** Lenis คุมตำแหน่ง scroll จริง — window.scrollTo อย่างเดียวมันดึงกลับที่เดิมในเฟรมถัดไป */
  const lenisRef = useRef<Lenis | null>(null)

  const finishSplash = () => {
    setShowSplash(false)
    setIntroDone()
    /**
     * บังคับกลับหัวหน้าเสมอตอนสปแลชจบ
     *
     * มีหลายทางที่หน้าจะไม่ได้อยู่ที่ 0 ตอนสปแลชปิด — เบราว์เซอร์คืนตำแหน่งเก่า, มี hash
     * ในลิงก์, bfcache ตอนกดย้อนกลับ, หรือ HMR ระหว่างพัฒนา ปิดทีละทางไม่จบ
     * และหน้านี้เล่าเรื่องตามตำแหน่ง scroll เปิดมากลางเรื่องคือเปิดมาเจอฉากที่ยังไม่ได้เล่า
     * จบด้วยการยืนยันที่จุดเดียว: พอสปแลชปิด ต้องอยู่ที่ 0
     */
    const put = () => {
      window.scrollTo(0, 0)
      lenisRef.current?.scrollTo(0, { immediate: true })
    }
    put()
    /**
     * ย้ำอีกสองสามจังหวะหลังสปแลชปิด
     *
     * ครั้งเดียวไม่พอ: หน้ายังสูงขึ้นอีกหลังจากนั้น (chunk 3D, ฟอนต์, รูปใน works ทยอยลง)
     * ทุกครั้งที่ของเหนือจุดที่มองอยู่สูงขึ้น เบราว์เซอร์มีสิทธิ์เลื่อนหน้าตาม — เห็นเป็น
     * "สปแลชจบแล้วหน้าไถลลงมาเอง" (ปิด overflow-anchor ไปแล้วอีกทาง ดู index.css)
     *
     * แต่ต้องเลิกย้ำทันทีที่คนดูขยับเอง ไม่งั้นเรากระชากหน้ากลับใส่หน้าเขาระหว่างที่เขาเลื่อนอยู่
     */
    const timers = [250, 700, 1500].map((ms) => setTimeout(put, ms))
    const stop = () => {
      for (const t of timers) clearTimeout(t)
      for (const ev of MOVE_EVENTS) window.removeEventListener(ev, stop)
    }
    for (const ev of MOVE_EVENTS) window.addEventListener(ev, stop, { passive: true })
  }

  useEffect(() => {
    /**
     * ปิด scroll restoration ของเบราว์เซอร์
     *
     * เดิมไม่ต้องปิดเพราะตอนสปแลชขึ้น หน้ายังสั้น (ฉากยังไม่ mount, scrollHeight = ความสูงจอ)
     * เบราว์เซอร์จึงคืนตำแหน่งเก่าไม่ได้แล้วยอมแพ้ไปเอง พอย้ายให้ฉาก mount ทันทีเพื่อให้
     * แถบโหลดมีอะไรให้วัด หน้าก็สูงเต็ม (4680px) ตั้งแต่วินาทีแรก — reload ทีไรเบราว์เซอร์
     * เลื่อนกลับไปตำแหน่งเดิมทุกที เห็นเป็น "สปแลชจบแล้วหน้าเลื่อนลงเอง"
     *
     * เรื่องนี้ต้องเป็น manual อยู่แล้วสำหรับหน้าที่เล่าเรื่องตามตำแหน่ง scroll:
     * เปิดมากลางเรื่องคือเปิดมาเจอฉากที่ยังไม่ได้เล่า
     */
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    if (SPLASH_ON) window.scrollTo(0, 0)

    // `smooth` / `resetNativeScroll` from the Vue version are not Lenis 1.x options.
    const lenis = new Lenis({ duration: 1, smoothWheel: true })
    lenisRef.current = lenis

    // สูตรผูก Lenis กับ GSAP: Lenis เดินด้วย ticker ของ gsap (นาฬิกาเดียวกับทุก tween)
    // แล้วแจ้ง ScrollTrigger ทุกครั้งที่ตำแหน่งเลื่อนขยับ — ไม่ต้องมี rAF loop ของตัวเอง
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (time: number) => lenis.raf(time * 1000) // ticker ให้วินาที Lenis กินมิลลิวินาที
    gsap.ticker.add(raf)
    /**
     * lag smoothing: เปิดไว้แต่ตั้งเพดานสูง
     *
     * ปิดสนิท (0) ตามที่ Lenis แนะนำ แปลว่าเฟรมที่ตกไป 400ms จะถูกจ่ายคืนทีเดียว —
     * ทวีนกระโดดข้ามไปข้างหน้าแทนที่จะเล่น เห็นชัดมากตอนสปแลชเล่นพร้อมกับที่ฉาก 3D
     * กำลัง mount (วัดจากภาพไล่เฟรม: ตัว E ประกอบเสร็จตั้งแต่วินาทีที่ 0.7 ทั้งที่ไทม์ไลน์
     * ตรงนั้นอยู่ที่ 1.3 วินาที)
     *
     * 700ms คือเพดานที่สูงพอจะไม่ไปยุ่งกับ Lenis ในการใช้งานปกติ (เฟรมตกระดับนั้น
     * ไม่เกิดตอน scroll อยู่แล้ว) แต่ยังกันการกระโดดก้อนใหญ่ตอนโหลดฉาก
     */
    gsap.ticker.lagSmoothing(700, 33)

    return () => {
      gsap.ticker.remove(raf)
      lenisRef.current = null
      lenis.destroy()
    }
  }, [])

  return (
    <div className="min-h-screen bg-paper">
      {/* The page renders underneath from the start — the splash zooms into the
          pupil and the mask hole reveals what is already there.

          The mascot gets the wordmark instead. The eye's whole point is that it
          opens onto the hero's own scene, and the mascot page has no such scene
          to open onto. */}
      {/* /new-hero เป็นหน้าเปล่าไว้ทดลอง — สปแลชของเว็บบังของที่กำลังจูนอยู่เปล่า ๆ */}
      {showSplash && !isIntroLab && !isNewHero &&
        (landedOn === '/2026' ? (
          /* /2026 มีอินโทรของตัวเอง (เศษโค้ด -> สนาม ASCII -> เวิร์ดมาร์ก)
             หน้าอื่นยังใช้สปแลชเดิม — คนละภาษาภาพกัน ไม่ควรบังคับให้เหมือน */
          <IntroSequence onDone={finishSplash} ready={sceneReady} onOpenStart={startIntro} />
        ) : landedOn3D ? (
          /* ฉาก 3D ของ joespresso ไม่มี "ตา" ให้เปิดออก และการ์ด hero ก็ยังโหลด three อยู่
             ตอนนั้น — ใช้สปแลชตัวอักษรคั่นแทน (port จาก branch 2026) */
          <JoeLettersSplash
            onDone={finishSplash}
            ready={sceneReady}
            onOpenStart={startIntro}
          />
        ) : landedOn === '/mascot' ? (
          <JoeSplash onDone={finishSplash} />
        ) : (
          <SplashScreen onEyeOpen={setEyeOpen} onDone={finishSplash} />
        ))}

      {isIntroLab ? (
        <IntroSandbox />
      ) : isV3 ? (
        <Portfolio2026FinalPage />
      ) : isNewHero ? (
        <NewHeroPage />
      ) : isV2 ? (
        <Portfolio2026Page />
      ) : /* /joespresso = ฉาก 3D เต็มจอ มี layout/nav ของตัวเอง — ไม่ใช้ shell ของเว็บ */
      isJoespresso ? (
        <Suspense fallback={null}>
          <Routes>
            <Route path="/joespresso" element={<JoespressoPage />} />
            <Route path="/joespresso/toolbar" element={<ToolbarWorkspace />} />
            {/* ฉาก 3 ทดลอง — โลกตารางหมากรุก (คอมพ์ 12601:287) */}
            <Route path="/joespresso/checker" element={<CheckerScene />} />
          </Routes>
        </Suspense>
      ) : (
        <>
          <NavBar />

          <ThemePicker />

          {/* Left anchor dots — homepage only */}
          {location.pathname === '/' && <AnchorNav />}

          <div className="pt-20">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/mascot" element={<MascotPage />} />
              {/* เครื่องมือ dev: หน้าดูคอมโพเนนต์เดี่ยว ๆ ก่อนตัดสินใจเอาไปต่อกับงานจริง
                  กั้นด้วย DEV — build production ไม่มี route นี้เลย */}
              {import.meta.env.DEV && (
                <Route path="/sandbox/driftwall" element={<DriftWallSandbox />} />
              )}
              <Route path="*" element={<NotPortedPage />} />
            </Routes>
            <Footer />
          </div>
        </>
      )}
    </div>
  )
}
