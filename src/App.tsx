import { useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router'
import Lenis from '@studio-freight/lenis'
import { SplashScreen } from '@/components/SplashScreen'
import { NavBar } from '@/components/NavBar'
import { AnchorNav } from '@/components/AnchorNav'
import { HomePage } from '@/pages/HomePage'
import { NotPortedPage } from '@/pages/NotPortedPage'
import { SITE } from '@/config/site'
import { setEyeOpen, setIntroDone } from '@/stores/intro'
import { useT } from '@/i18n/store'

function Footer() {
  const t = useT()
  return (
    <footer className="mt-16 w-full bg-paper pb-16 text-center">
      <div className="border-t border-black/10 px-6">
        <p className="mt-6 text-sm text-black/30">
          {t('footer.credit', { name: SITE.name, year: SITE.copyrightYear })}
        </p>
      </div>
    </footer>
  )
}

export function App() {
  const [showSplash, setShowSplash] = useState(true)
  const location = useLocation()

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
          pupil and the mask hole reveals what is already there. */}
      {showSplash && (
        <SplashScreen
          onEyeOpen={setEyeOpen}
          onDone={() => {
            setShowSplash(false)
            setIntroDone()
          }}
        />
      )}

      <NavBar />

      {/* Left anchor dots — homepage only */}
      {location.pathname === '/' && <AnchorNav />}

      <div className="pt-20">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<NotPortedPage />} />
        </Routes>
        <Footer />
      </div>
    </div>
  )
}
