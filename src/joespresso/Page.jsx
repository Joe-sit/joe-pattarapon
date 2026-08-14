import { useEffect, useRef } from 'react'
import { Leva } from 'leva'
import { Scene } from './App'
import { Logo } from './Logo'
import { GithubIcon, InstagramIcon, LinkedinIcon } from './Icons'
import { scrollState, SPLIT } from './scroll'
import './page.css'

/**
 * แผง debug โผล่เฉพาะตอน dev — ของจริงไม่ควรเห็นปุ่มจูนฉาก
 * ถ้าอยากจูนบน build ที่ deploy แล้ว เติม ?debug ท้าย URL
 */
const DEBUG_UI =
  import.meta.env.DEV ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'))

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

  // scroll → progress: ครึ่งแรกของราง = --sp (การ์ดขยาย + กล้อง focus)
  //                    ครึ่งหลัง      = --sp2 (ดื่มกาแฟ -> สีคลุมเฟรม -> เนื้อหาถัดไป)
  // แยกเป็นสองตัวแทนที่จะยืดตัวเดิม เพราะค่ากล้อง/การ์ดถูกจูนไว้กับ 0..1 ของช่วงแรกแล้ว
  useEffect(() => {
    const clamp01 = (v) => Math.min(1, Math.max(0, v))
    const onScroll = () => {
      const range = document.documentElement.scrollHeight - window.innerHeight
      const raw = range > 0 ? clamp01(window.scrollY / range) : 0
      const p = clamp01(raw / SPLIT)
      const p2 = clamp01((raw - SPLIT) / (1 - SPLIT))
      scrollState.p = p
      scrollState.p2 = p2
      const s = document.documentElement.style
      s.setProperty('--sp', p.toFixed(4))
      s.setProperty('--sp2', p2.toFixed(4))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      scrollState.p = 0
      scrollState.p2 = 0
      document.documentElement.style.removeProperty('--sp')
      document.documentElement.style.removeProperty('--sp2')
    }
  }, [])

  return (
    <div className="jp-scroll">
      <div className="jp-page">
        {/* debug GUI — พับเก็บไว้ ไม่บังหน้า */}
        {/* data-lenis-prevent: Lenis (smooth scroll ของทั้งเว็บ) ดัก wheel ไว้หมด
            ถ้าไม่กันไว้ ล้อเมาส์บนแผงจะไปเลื่อนหน้าแทนที่จะเลื่อนในแผง */}
        <div className="jp-leva" data-lenis-prevent>
          {/* ไม่ตั้ง position ให้ titleBar — leva แปลงค่านั้นเป็น transform: translate3d() ซึ่งดัน
              ตัวแผงหลุดออกนอกกล่อง scroll ที่ครอบไว้ (แผงหายไปเลย) ตำแหน่งจัดที่ .jp-leva ใน CSS แทน */}
          {/* กว้างขึ้นจาก default 280 — ชื่อ control ภาษาไทยยาวกว่าช่อง label เดิม (~120px) แล้วถูกตัดหาย
              rootWidth - controlWidth = ที่เหลือของ label จึงต้องขยาย root มากกว่าที่ขยาย control */}
          <Leva
            collapsed
            hidden={!DEBUG_UI}
            titleBar={{ title: 'debug' }}
            theme={{
              sizes: {
                rootWidth: '460px',
                controlWidth: '175px',
                // ช่องตัวเลข default แคบไป ค่าติดลบทศนิยมสองตำแหน่ง (-0.05) ถูกตัดเหลือ "-0.0"
                numberInputMinWidth: '64px',
              },
            }}
          />
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

            {/* ฉาก 2 — ขับด้วย --sp2 ล้วน ๆ ไม่มี state ฝั่ง React (ไม่งั้น re-render ทุกเฟรมที่ scroll)
                ลำดับ: mascot ยกแก้วดื่ม (0-.55) -> สีแผ่จากแก้วคลุมเฟรม (.45-.82) -> เนื้อหาโผล่ (.78-1) */}
            <div className="jp-fill" aria-hidden="true" />
            <section className="jp-next" aria-label="Next">
              <p className="jp-next-kicker">One sip later</p>
              <h2 className="jp-next-title">Let&rsquo;s build something</h2>
              <p className="jp-next-sub">Design engineer · 3D · motion</p>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
