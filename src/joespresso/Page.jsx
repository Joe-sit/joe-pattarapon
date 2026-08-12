import { useEffect } from 'react'
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
        <Leva collapsed titleBar={{ title: 'debug', position: { x: 0, y: 64 } }} />
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
            <ul className="jp-social">
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
