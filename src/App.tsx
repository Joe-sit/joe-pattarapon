import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router'
import Lenis from '@studio-freight/lenis'
import { SplashScreen } from '@/components/SplashScreen'
import { JoeSplash } from '@/components/JoeSplash'
import { NavBar } from '@/components/NavBar'
import { ThemePicker } from '@/components/ThemePicker'
import { AnchorNav } from '@/components/AnchorNav'
import { HomePage } from '@/pages/HomePage'
import { MascotPage } from '@/pages/MascotPage'
import { NotPortedPage } from '@/pages/NotPortedPage'
// ฉาก 3D หนัก (three.js) — lazy แยก chunk ไม่ถ่วงหน้าอื่น
const JoespressoPage = lazy(() => import('@/joespresso/Page'))
import { SITE } from '@/config/site'
import { setEyeOpen, setIntroDone } from '@/stores/intro'
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

export function App() {
  const [showSplash, setShowSplash] = useState(true)
  const location = useLocation()
  const isJoespresso = location.pathname === '/joespresso'

  // Which splash plays is decided by where the visitor landed, not by where
  // they are now — it runs once, on load, and reading `location` live would
  // swap it mid-animation the moment they navigated.
  const [landedOn] = useState(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname,
  )
  const finishSplash = () => {
    setShowSplash(false)
    setIntroDone()
  }

  useEffect(() => {
    window.scrollTo(0, 0)

    // `smooth` / `resetNativeScroll` from the Vue version are not Lenis 1.x options.
    const lenis = new Lenis({ duration: 1, smoothWheel: true })
    let frame = requestAnimationFrame(function raf(time) {
      lenis.raf(time)
      frame = requestAnimationFrame(raf)
    })

    return () => {
      cancelAnimationFrame(frame)
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
      {showSplash &&
        landedOn !== '/joespresso' &&
        (landedOn === '/mascot' ? (
          <JoeSplash onDone={finishSplash} />
        ) : (
          <SplashScreen onEyeOpen={setEyeOpen} onDone={finishSplash} />
        ))}

      {/* /joespresso = ฉาก 3D เต็มจอ มี layout/nav ของตัวเอง — ไม่ใช้ shell ของเว็บ */}
      {isJoespresso ? (
        <Suspense fallback={null}>
          <Routes>
            <Route path="/joespresso" element={<JoespressoPage />} />
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
              <Route path="*" element={<NotPortedPage />} />
            </Routes>
            <Footer />
          </div>
        </>
      )}
    </div>
  )
}
