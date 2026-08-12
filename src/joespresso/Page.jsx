import { useEffect, useRef } from 'react'
import { Leva } from 'leva'
import { Scene } from './App'
import { Logo } from './Logo'
import { GithubIcon, InstagramIcon, LinkedinIcon } from './Icons'
import { scrollState } from './scroll'
import './page.css'

const NAV = [
  { label: 'About', href: '#about' },
  { label: 'Works', href: '#works' },
  { label: 'Sandbox', href: '#sandbox' },
]

const SOCIAL = [
  { name: 'GitHub', Icon: GithubIcon, href: 'https://github.com/Joe-sit' },
  { name: 'LinkedIn', Icon: LinkedinIcon, href: '#' },
  { name: 'Instagram', Icon: InstagramIcon, href: '#' },
]

export default function Page() {
  const socialRef = useRef(null)


  // ยาเม็ด hover ของโซเชียล — ขยายจากจุดที่เมาส์เข้า ยุบกลับไปทางจุดที่เมาส์ออก
  // ใช้ Web Animation เพราะระบุ keyframe เริ่มได้ตรง ๆ; ถ้าใช้ CSS transition เบราว์เซอร์จะเริ่ม
  // จากค่าที่ commit ไว้รอบก่อน (clip-path ไม่กระทบ layout จึงบังคับ recalc กลางคันไม่ได้)
  useEffect(() => {
    const ul = socialRef.current
    const pill = ul?.querySelector('.jp-social-pill')
    if (!pill || !window.matchMedia('(hover: hover)').matches) return

    const OPEN = 'inset(0% 0 0% 0 round 999px)'
    const collapsedAt = (e) => {
      const r = ul.getBoundingClientRect()
      const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))
      return `inset(${y.toFixed(1)}% 0 ${(100 - y).toFixed(1)}% 0 round 999px)`
    }

    let anim = null
    const play = (from, to) => {
      anim?.cancel()
      const slow = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      anim = pill.animate([{ clipPath: from }, { clipPath: to }], {
        duration: slow ? 0 : 320,
        easing: 'ease-out',
        fill: 'forwards',
      })
    }

    const onEnter = (e) => {
      ul.classList.add('is-open')
      play(collapsedAt(e), OPEN)
    }
    const onLeave = (e) => {
      ul.classList.remove('is-open')
      play(OPEN, collapsedAt(e))
    }

    ul.addEventListener('pointerenter', onEnter)
    ul.addEventListener('pointerleave', onLeave)
    return () => {
      anim?.cancel()
      ul.removeEventListener('pointerenter', onEnter)
      ul.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  // scroll → progress 0..1: การ์ดขยายเต็มจอ + กล้องหมุนไป focus mascot
  useEffect(() => {
    const onScroll = () => {
      const range = document.documentElement.scrollHeight - window.innerHeight
      const p = range > 0 ? Math.min(1, Math.max(0, window.scrollY / range)) : 0
      scrollState.p = p
      document.documentElement.style.setProperty('--sp', p.toFixed(4))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      scrollState.p = 0
      document.documentElement.style.removeProperty('--sp')
    }
  }, [])

  return (
    <div className="jp-scroll">
      <div className="jp-page">
        {/* debug GUI — พับเก็บไว้ ไม่บังหน้า */}
        {/* data-lenis-prevent: Lenis (smooth scroll ของทั้งเว็บ) ดัก wheel ไว้หมด
            ถ้าไม่กันไว้ ล้อเมาส์บนแผงจะไปเลื่อนหน้าแทนที่จะเลื่อนในแผง */}
        <div className="jp-leva" data-lenis-prevent>
          <Leva collapsed titleBar={{ title: 'debug', position: { x: 0, y: 64 } }} />
        </div>
        <header className="jp-nav">
          <a className="jp-nav-logo" href="/" aria-label="Joe — home">
            <Logo />
          </a>
          <nav className="jp-nav-links">
            {NAV.map((n) => (
              <a key={n.label} href={n.href}>
                {n.label}
              </a>
            ))}
          </nav>
        </header>

        <main className="jp-hero">
          <div className="jp-hero-card">
            <Scene />

            {/* overlay บนการ์ด — ไอคอนโซเชียลซ้ายล่าง, ที่อยู่ขวาล่าง */}
            <ul className="jp-social" ref={socialRef}>
              <li className="jp-social-pill" aria-hidden="true" />
              {SOCIAL.map(({ name, Icon, href }) => (
                <li key={name}>
                  <a href={href} target="_blank" rel="noreferrer" aria-label={name}>
                    <Icon />
                  </a>
                </li>
              ))}
            </ul>
            <p className="jp-based">Based in Bangkok, Thailand</p>
          </div>
        </main>
      </div>
    </div>
  )
}
