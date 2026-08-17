import { useEffect, useRef } from 'react'
import { Leva } from 'leva'
import { Scene } from './App'
import { Logo } from './Logo'
import { GithubIcon, InstagramIcon, LinkedinIcon } from './Icons'
import { BEATS, resetBeats, updateBeats } from './scroll'
import { introState } from './intro'
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

/** หัวข้อของ section 2 — คำโผล่ทีละคำ ส่วนแผงด้านล่างค่อยคลี่ตามทีหลัง */
const WHAT_TITLE = ['What', 'I do']

/**
 * สองแผงของ "What I do"
 *
 * ทุกอย่างในนี้ตรวจสอบได้จากตัวโปรเจกต์เอง ไม่ได้แต่งขึ้น:
 * tags ของ Develop มาจาก dependencies จริงใน package.json ส่วน Design อ้างจากวิธีทำงานของ repo นี้
 * (ไฟล์ Figma ชื่อ Joespresso + mascot ที่ปั้นด้วยโค้ดใน src/sections/mascot ไม่ได้ import โมเดลมา)
 * ถ้ามีข้อความจริงของตัวเองแล้วแก้ที่ตารางนี้ที่เดียว — จำนวนแผง/แท็กคิดตามเอง
 */
const WHAT = [
  {
    id: 'design',
    kicker: 'UI/UX',
    title: 'Design',
    // ไอคอนเป็นไฟล์ที่ export จาก Figma โดยตรง ไม่ได้วาด path เอง
    icon: '/icons/pointer.svg',
    tone: '#fd5000',
    desc: 'Transforming abstract idea into high-fidelity wireframe.',
    tags: ['User Research', 'User-centered Design', 'Wireframe', 'Prototype', 'User Testing'],
  },
  {
    id: 'develop',
    kicker: 'Front-end',
    title: 'Develop',
    icon: '/icons/prompt.svg',
    tone: '#a996eb',
    desc: 'React and TypeScript on Vite, with the 3D work in react-three-fiber.',
    tags: ['React', 'TypeScript', 'Three.js', 'R3F', 'Vite', 'Motion'],
  },
]

/** จำนวนคำของหัวข้อ — ใช้เป็นตัวหารของจังหวะทยอยโผล่ */
const WHAT_WORDS = WHAT_TITLE.join(' ').split(' ').length

/**
 * ตัดข้อความเป็นคำ ๆ แล้วติดหมายเลขลำดับไว้ให้ CSS
 * start = ลำดับของคำแรกในชุดนี้ (นับต่อกันทั้ง section ไม่ใช่เริ่มใหม่ทุกบรรทัด)
 */
function Words({ text, start }) {
  return text.split(' ').map((w, i) => (
    <span className="jp-word" key={`${start + i}-${w}`} style={{ '--i': start + i }}>
      {w}
    </span>
  ))
}

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

  /**
   * เปิดฉากหลังสปแลชส่งไม้ต่อ — กรอบการ์ดคลี่ออก แล้วแถบเมนูโผล่ขึ้นมาจากใต้การ์ด
   *
   * ขับด้วยนาฬิกาของ intro ไม่ใช่ timer ของตัวเอง: สปแลชกับฉากเดินด้วยเวลาเดียวกันอยู่แล้ว
   * (startIntro ถูกเรียกตอนรูเริ่มเปิด) ถ้าตั้งเวลาแยกจะเลื่อนหลุดกันทันทีที่เฟรมตก
   *
   * ค่าออกมาเป็น CSS variable ตัวเดียว (--jp-open) ให้ CSS เอาไปกระจายเอง — ไม่ต้อง re-render
   * React ทุกเฟรมตลอดช่วงเปิดฉาก
   */
  useEffect(() => {
    const s = document.documentElement.style
    const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
    let frame = 0
    const tick = () => {
      // เริ่มนับหลังสปแลชถอดออก (ซูมยาว 1.4 วิ) แล้วคลี่ต่ออีก 1.1 วิ
      const k = clamp01((introState.t - 1.35) / 1.1)
      // ease-out: ออกตัวเร็วแล้วคลายเข้าที่ — ตรงข้ามกับการซูมที่เร่งขึ้นเรื่อย ๆ ก่อนหน้า
      s.setProperty('--jp-open', String(1 - Math.pow(1 - k, 3)))
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(frame)
      s.removeProperty('--jp-open')
    }
  }, [])

  // scroll → บีต: ลำดับและความยาวของเรื่องอยู่ในตาราง BEATS ที่ scroll.js
  // ที่นี่ทำแค่แปลงตำแหน่ง scroll เป็น 0..1 แล้วโยนเข้า updateBeats
  useEffect(() => {
    const onScroll = () => {
      const range = document.documentElement.scrollHeight - window.innerHeight
      const raw = range > 0 ? window.scrollY / range : 0
      const s = document.documentElement.style
      for (const [k, v] of updateBeats(raw)) s.setProperty(k, v)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      resetBeats()
      const s = document.documentElement.style
      for (const [name] of BEATS) s.removeProperty(`--b-${name}`)
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

            {/* ฉาก 2 — ขับด้วยตัวแปร --b-* ล้วน ๆ ไม่มี state ฝั่ง React (ไม่งั้น re-render ทุกเฟรมที่ scroll)
                สีที่คลุมเฟรมไม่ได้อยู่ตรงนี้แล้ว — หมอกกับพื้นหลังในฉาก 3D เป็นคนกลืนภาพเอง
                (ดู SceneFill ใน App.jsx) เหลือแค่บรรทัดส่งต่อที่ลอยขึ้นมาทีหลัง */}
            <section className="jp-next" aria-label="Next">
              <h2 className="jp-next-title">I turn coffee into works</h2>
            </section>

            {/* ฉาก 2 — "What I do" ในครึ่งขวาที่กล้องเว้นไว้ ขับด้วยบีต about ตัวเดียว
                หัวข้อขึ้นทีละคำ แล้วแผงค่อยคลี่ตาม; ทำใน CSS ล้วนเพราะบีตมาเป็นตัวแปร CSS อยู่แล้ว
                (ให้ React มายุ่งจะ re-render ทุกเฟรมที่สกรอลล์)

                กางแผงเป็น hover ล้วน ๆ ไม่มี state — จอสัมผัสไม่มี hover จึงเปิดด้วย :focus-within
                ผ่านปุ่มข้างใน ซึ่งได้ keyboard เข้ามาฟรีด้วย (moncy ต้องเขียน JS toggle class เอง) */}
            <section
              className="jp-what"
              id="about"
              aria-label="What I do"
              style={{ '--n': WHAT_WORDS }}
            >
              <h2 className="jp-what-title">
                <Words text={WHAT_TITLE[0]} start={0} />
                <span className="jp-what-break" />
                <Words text={WHAT_TITLE[1]} start={WHAT_TITLE[0].split(' ').length} />
              </h2>

              <div className="jp-what-stack">
                {WHAT.map((card, i) => (
                  <article className="jp-what-card" key={card.id} style={{ '--c': i, '--tone': card.tone }}>
                    <header className="jp-what-head">
                      <span className="jp-what-icon" aria-hidden="true">
                        <img src={card.icon} alt="" />
                      </span>
                      <span className="jp-what-name">
                        <span className="jp-what-kicker">{card.kicker}</span>
                        <h3>{card.title}</h3>
                      </span>
                    </header>
                    <p className="jp-what-desc">{card.desc}</p>
                    <ul className="jp-what-tags">
                      {card.tags.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    {/* ปุ่มจริง ไม่ใช่ div — เป็นตัวรับ focus ที่ยกการ์ดขึ้นมาบนคีย์บอร์ดกับจอสัมผัส */}
                    <button
                      className="jp-what-pick"
                      type="button"
                      aria-label={`${card.kicker} ${card.title} — skillset and tools`}
                    />
                  </article>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
