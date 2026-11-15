import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

/**
 * ฟองแชตกลายเป็นดิจิทัลโปรดักต์ — ชั้น DOM บนแคนวาสของฟอง (ดู ./BubbleTraveler)
 *
 * ฟองแก้วที่เดินทางมาจากหัวเรื่องคือ "ข้อความล่าสุดของ Joe" ในแชตกับลูกค้า ทุกฉากต่อจากชิ้นเดิม ไม่มีการตัด:
 *   zoom      ถอยกล้องออก — ฟองหดลงไปนั่งในช่องของมันในบทสนทนา ข้อความก่อนหน้าโผล่รอบตัว
 *   chat      ลูกค้าพิมพ์ความต้องการทีละข้อความ (จุดกำลังพิมพ์ก่อน) แชตเลื่อนขึ้นตามข้อความใหม่ Joe ตอบรับ
 *   research  คำสำคัญในข้อความความต้องการถูกไฮไลต์ แล้ว *ตัวข้อความเอง* หลุดจากแชตกลายเป็นโน้ต — แชตที่เหลือจางไป
 *   design    ฟองของ Joe พองเป็นกรอบโปรดักต์ (แก้วตัวเดียวกัน — ทำใน BubbleTraveler) โน้ตบินเข้ากรอบ
 *             ลงตรงชิ้น wireframe ที่มันกลายเป็น แล้วโครงที่เหลือวาดตาม — หัวเรื่องของหน้าคือข้อความในฟอง
 *   code      ตัวแก้โค้ดเลื่อนเข้า พิมพ์ทีละบรรทัด — บรรทัดไหนจบ ชิ้นนั้นเป็นของจริง
 *   ship      ตัวแก้โค้ดหลบออก เหลือโปรดักต์ที่เสร็จ ป้าย Live ติด
 *
 * ทุกค่าคิดจากตำแหน่งเลื่อน เขียนลง style ตรง ๆ ไม่ผ่าน state — เลื่อนกลับก็ถอยกลับ
 * ข้อความในแชตเป็นบทของเรื่อง (ไม่ใช่ข้อมูลลูกค้าจริง)
 */

export type StoryPose = {
  on: boolean
  /** กลางฟอง (px จอ) */
  x: number
  y: number
  h: number
  /** ถอยกล้อง: กลางช่องของฟองบนจอเฟรมนี้ (cx, cy) กับสเกลของทั้งบทสนทนา */
  zoom: number
  zx: number
  zy: number
  zs: number
  chat: number
  research: number
  head: number
  design: number
  code: number
  ship: number
  /** กรอบเนื้อหาของพาเนล (px จอ) */
  box: { x: number; y: number; w: number; h: number }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => {
  const u = clamp01(v)
  return u * u * (3 - 2 * u)
}
const seg = (k: number, a: number, d: number) => clamp01((k - a) / d)
const outBack = (x: number) => {
  const u = clamp01(x) - 1
  return 1 + 2.4 * u * u * u + 1.4 * u * u
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/** ความสูงข้อความหนึ่งบรรทัดในแชต (px) — ฟองแก้วหดลงมาเท่านี้ตอนถอยกล้องจบ */
export const MSG_H = 54

/** ช่องของฟองแก้วในแชต — BubbleTraveler อ่านตำแหน่ง (ไม่รวมสเกลถอยกล้อง) ไปวางฟอง */
export const CHAT_SLOT_ID = 'chat-slot'
/** ความกว้างของฟองแก้วตอนเป็นข้อความ (px) — ฟองเขียนให้ทุกเฟรม ช่องในแชตกว้างตาม */
export const chatSlot = { w: 220 }

type Msg = { who: 'client' | 'joe'; text: string; at: number; key?: string[]; part?: string }
/**
 * บทสนทนา — at = จังหวะที่ข้อความโผล่ (สัดส่วนของ BEAT.chat · ติดลบ = มีอยู่แล้วก่อนถอยกล้อง)
 * ข้อความความต้องการ (มี part) คือข้อความที่จะกลายเป็นโน้ต แล้วเป็นชิ้นนั้นบนหน้า · key = คำที่ถูกไฮไลต์ตอน research
 */
const THREAD: Msg[] = [
  { who: 'client', text: "Hi Joe! We're launching something new.", at: -1 },
  { who: 'joe', text: "Hello, I'm Joe", at: -1 },
  { who: 'client', text: 'Could you help us build it?', at: -1 },
  { who: 'joe', text: '', at: -1 }, // ช่องของฟองแก้ว ("Here is what I do")
  { who: 'client', text: 'People should sign up in a minute', at: 0.05, key: ['sign up', 'in a minute'], part: 'cta' },
  { who: 'client', text: 'Most of them are on their phones', at: 0.3, key: ['on their phones'], part: 'nav' },
  { who: 'client', text: 'And it should feel friendly', at: 0.55, key: ['friendly'], part: 'art' },
  { who: 'joe', text: "Got it. Let's dig in.", at: 0.82 },
]
const SLOT = THREAD.findIndex((m) => m.who === 'joe' && !m.text)
/** ข้อความความต้องการ → ที่ของโน้ตตอน research (สัดส่วนจอ) */
const NOTE_AT = [
  { x: 0.24, y: 0.34, r: -4 },
  { x: 0.5, y: 0.24, r: 3 },
  { x: 0.74, y: 0.36, r: -2 },
]

/** หัวเรื่องของหน้า = ข้อความในฟอง */
const HEADLINE = "Hello, I'm Joe"
/** โค้ดของหน้า — หนึ่งบรรทัดต่อหนึ่งชิ้นบนหน้า ตามลำดับที่พิมพ์ */
const CODE: { part: string; line: string }[] = [
  { part: 'nav', line: "<Nav links={['About', 'Work', 'Contact']} />" },
  { part: 'title', line: `<h1>${HEADLINE}</h1>` },
  { part: 'cta', line: '<Button>Sign up</Button>' },
  { part: 'art', line: '<Hero art="friendly" />' },
  { part: 'cards', line: '<Cards count={3} />' },
]
const CODE_LEN = CODE.reduce((n, c) => n + c.line.length, 0)
/** ลำดับที่ wireframe วาดในขั้น Design — ชิ้นที่มาจากโน้ตวาดตอนโน้ตลงจอด */
const WIRE_ORDER = ['nav', 'title', 'cta', 'art', 'cards']
const wireAt = (i: number) => 0.3 + i * 0.12

/** ข้อความที่มีคำไฮไลต์ — แยกเป็นช่วง เพื่อให้คำสำคัญมีพื้นไฮไลต์ของตัวเอง */
function Marked({ text, keys }: { text: string; keys?: string[] }) {
  if (!keys?.length) return <>{text}</>
  const out: (string | { k: string })[] = []
  let rest = text
  while (rest) {
    let hit = -1
    let key = ''
    for (const k of keys) {
      const i = rest.indexOf(k)
      if (i >= 0 && (hit < 0 || i < hit)) {
        hit = i
        key = k
      }
    }
    if (hit < 0) {
      out.push(rest)
      break
    }
    if (hit > 0) out.push(rest.slice(0, hit))
    out.push({ k: key })
    rest = rest.slice(hit + key.length)
  }
  return (
    <>
      {out.map((o, i) =>
        typeof o === 'string' ? (
          <span key={i}>{o}</span>
        ) : (
          <mark key={i} className="ps-mark">
            {o.k}
          </mark>
        ),
      )}
    </>
  )
}

export function ProductStory({ bind }: { bind: React.RefObject<((p: StoryPose) => void) | null> }) {
  const thread = useRef<HTMLDivElement>(null)
  const zoomer = useRef<HTMLDivElement>(null)
  const rows = useRef<(HTMLDivElement | null)[]>([])
  const msgs = useRef<(HTMLDivElement | null)[]>([])
  const typing = useRef<HTMLDivElement>(null)
  const slot = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const page = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const editor = useRef<HTMLDivElement>(null)
  const codeLines = useRef<(HTMLSpanElement | null)[]>([])
  const caret = useRef<HTMLSpanElement>(null)
  const live = useRef<HTMLDivElement>(null)
  const parts = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    bind.current = (p) => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const th = thread.current
      const zm = zoomer.current
      if (!th || !zm) return

      /* ── แชต: มีอยู่ตั้งแต่ถอยกล้อง หายเมื่อทุกข้อความออกไปแล้ว ── */
      /* โน้ตยังบินเข้ากรอบอยู่ช่วง design — ชั้นแชตอยู่จนโน้ตตัวสุดท้ายกลืนเป็นชิ้นของมัน */
      const chatOn = p.on && p.zoom > 0 && p.design < 0.95
      th.style.visibility = chatOn ? 'visible' : 'hidden'
      if (slot.current) slot.current.style.width = `${chatSlot.w.toFixed(1)}px`
      /* ถอยกล้อง: ทั้งบทสนทนาสเกลรอบช่องของฟอง แล้วเลื่อนให้ช่องตรงกับที่ฟองอยู่บนจอเฟรมนี้ */
      const sl = slot.current
      if (sl) {
        const ox = sl.offsetLeft + sl.offsetWidth / 2
        const oy = sl.offsetTop + sl.offsetHeight / 2
        zm.style.transformOrigin = `${ox.toFixed(1)}px ${oy.toFixed(1)}px`
        const sx = th.offsetLeft + ox
        const sy = th.offsetTop + oy
        zm.style.transform = `translate(${(p.zx - sx).toFixed(1)}px, ${(p.zy - sy).toFixed(1)}px) scale(${p.zs.toFixed(4)})`
      }
      /* บทสนทนาเก่าค่อยชัดขึ้นตอนกล้องเริ่มถอย — ก่อนหน้านั้นมีแต่ฟอง */
      zm.style.opacity = String(smooth(p.zoom / 0.35))

      /* ข้อความใหม่: แถวกางออก (ดันข้อความเก่าขึ้น) แล้วฟองข้อความเด้งเข้า · ก่อนข้อความลูกค้ามีจุดกำลังพิมพ์ */
      let typingFor = -1
      THREAD.forEach((m, i) => {
        const row = rows.current[i]
        const el = msgs.current[i]
        if (!row || !el) return
        const k = m.at < 0 ? 1 : smooth(seg(p.chat, m.at, 0.1))
        row.style.gridTemplateRows = `${k.toFixed(3)}fr`
        if (m.at >= 0 && m.who === 'client' && p.chat > m.at - 0.08 && p.chat < m.at) typingFor = i
        if (i === SLOT) return
        /* research: ข้อความความต้องการหลุดไปเป็นโน้ต · ที่เหลือจาง */
        const ri = m.part ? THREAD.filter((t) => t.part).indexOf(m) : -1
        const fade = smooth(seg(p.research, 0.35, 0.3))
        if (ri < 0) {
          /* ข้อความที่ไม่ได้เป็นโน้ต (ทักทาย/ตอบรับ) จางและจมลงนิด ๆ ตอนโน้ตหลุดออก — เหลือแต่ของที่จะไปต่อ */
          const shown = m.at < 0 ? 1 : clamp01((p.chat - m.at) / 0.06)
          const pop = m.at < 0 ? 1 : Math.max(0.001, Math.min(1, outBack(seg(p.chat, m.at + 0.02, 0.12))))
          el.style.opacity = String(shown * (1 - fade))
          el.style.transform = `translateY(${(fade * 10).toFixed(1)}px) scale(${(pop * (1 - fade * 0.06)).toFixed(3)})`
          return
        }
        const pop = m.at < 0 ? 1 : outBack(seg(p.chat, m.at + 0.02, 0.12))
        /* ไฮไลต์คำสำคัญก่อน แล้วหลุดออกมาเป็นโน้ต */
        el.style.setProperty('--hl', smooth(seg(p.research, 0.05 + ri * 0.08, 0.2)).toFixed(3))
        const go = smooth(seg(p.research, 0.3 + ri * 0.08, 0.4))
        el.style.setProperty('--n', go.toFixed(3))
        /* ตำแหน่งจริงบนจอของข้อความ (หลังสเกลถอยกล้อง = 1 แล้ว) → ที่ของโน้ต */
        const r = el.getBoundingClientRect()
        const curX = r.left + r.width / 2 - (Number(el.dataset.dx) || 0)
        const curY = r.top + r.height / 2 - (Number(el.dataset.dy) || 0)
        const t = NOTE_AT[ri]
        /* design: โน้ตบินเข้ากรอบ ลงตรงชิ้นของตัวเอง แล้วกลืนเข้าไปเป็นชิ้นนั้น */
        const part = parts.current[m.part as string]
        const wi = WIRE_ORDER.indexOf(m.part as string)
        const fly = smooth(seg(p.design, 0.02 + ri * 0.06, wireAt(wi) - 0.02 - ri * 0.06))
        let tx = t.x * vw
        let ty = t.y * vh
        let sc = 1
        if (part && fly > 0) {
          const pr = part.getBoundingClientRect()
          tx = lerp(tx, pr.left + pr.width / 2, fly)
          ty = lerp(ty, pr.top + pr.height / 2, fly)
          sc = lerp(1, 0.55, fly)
        }
        const melt = smooth(seg(p.design, wireAt(wi), 0.12))
        /* ก่อนแผงพองเต็ม โน้ตยังลอยอยู่ข้างนอก — รอแผงก่อนค่อยบิน (fly นับจาก design) */
        const dx = (tx - curX) * go
        const dy = (ty - curY) * go
        el.dataset.dx = String(dx)
        el.dataset.dy = String(dy)
        const bob = Math.sin(p.research * 7 + ri * 2) * 4 * go * (1 - fly)
        el.style.transform = `translate(${dx.toFixed(1)}px, ${(dy + bob).toFixed(1)}px) rotate(${(t.r * go * (1 - fly)).toFixed(2)}deg) scale(${(Math.max(0.001, Math.min(1, pop)) * sc).toFixed(3)})`
        el.style.opacity = String(clamp01(m.at < 0 ? 1 : (p.chat - m.at) / 0.06) * (1 - melt))
      })
      const ty = typing.current
      if (ty) {
        const row = rows.current[typingFor]
        ty.style.visibility = typingFor >= 0 && chatOn ? 'visible' : 'hidden'
        if (row && typingFor >= 0) {
          ty.style.top = `${row.offsetTop}px`
        }
      }

      /* ── กรอบโปรดักต์ = กรอบเนื้อหาของพาเนลแก้ว ── */
      const fr = frame.current
      if (!fr) return
      const show = p.on && p.head > 0.6
      fr.style.visibility = show ? 'visible' : 'hidden'
      fr.style.left = `${p.box.x}px`
      fr.style.top = `${p.box.y}px`
      fr.style.width = `${p.box.w}px`
      fr.style.height = `${p.box.h}px`
      fr.style.setProperty('--u', `${(p.box.w / 100).toFixed(3)}px`)
      if (!show) return
      fr.style.opacity = String(smooth((p.head - 0.6) / 0.4))

      const g = grid.current
      if (g) g.style.opacity = String(smooth(seg(p.design, 0, 0.2)) * (1 - smooth(seg(p.code, 0.6, 0.3))) * 0.9)

      /* โค้ด: พิมพ์ทีละตัว · บรรทัดไหนจบ ชิ้นนั้นจริง */
      const typed = Math.round(seg(p.code, 0.08, 0.72) * CODE_LEN)
      let left = typed
      let caretAt = -1
      const real: Record<string, number> = {}
      CODE.forEach((c, i) => {
        const el = codeLines.current[i]
        const n = Math.max(0, Math.min(c.line.length, left))
        left -= c.line.length
        if (el) el.textContent = c.line.slice(0, n)
        if (n < c.line.length && caretAt < 0) caretAt = i
        real[c.part] = n >= c.line.length ? 1 : 0
      })
      if (caretAt < 0) caretAt = CODE.length - 1
      const cr = caret.current
      if (cr) {
        const host = codeLines.current[caretAt]?.parentElement
        if (host && cr.parentElement !== host) host.appendChild(cr)
        cr.style.visibility = p.code > 0.05 && p.ship < 0.3 ? 'visible' : 'hidden'
      }
      const ed = editor.current
      if (ed) {
        const inK = smooth(seg(p.code, 0, 0.12))
        const outK = smooth(seg(p.ship, 0, 0.5))
        ed.style.transform = `translateX(${(-(1 - inK) * 110 - outK * 110).toFixed(1)}%)`
        ed.style.opacity = String(inK * (1 - outK))
      }
      const pg = page.current
      if (pg) {
        /* ย่อโดยยึดขอบขวา — หน้าอยู่ 58% ขวา ตัวแก้โค้ด 40% ซ้าย */
        const side = smooth(seg(p.code, 0, 0.12)) * (1 - smooth(seg(p.ship, 0, 0.5)))
        pg.style.transform = `scale(${(1 - side * 0.42 + smooth(seg(p.ship, 0.4, 0.6)) * 0.015).toFixed(4)})`
        pg.style.setProperty('--bg', String(real.nav ? 1 : 0))
      }
      WIRE_ORDER.forEach((name, i) => {
        const el = parts.current[name]
        if (!el) return
        el.style.setProperty('--w', smooth(seg(p.design, wireAt(i), 0.16)).toFixed(3))
        el.style.setProperty('--r', String(real[name] ?? 0))
      })
      const lv = live.current
      if (lv) {
        const k = outBack(seg(p.ship, 0.45, 0.4))
        lv.style.opacity = String(clamp01(k))
        lv.style.transform = `scale(${Math.max(0.001, k).toFixed(3)})`
      }
    }
    return () => {
      bind.current = null
    }
  }, [bind])

  const part = (name: string) => (el: HTMLElement | null) => {
    parts.current[name] = el
  }

  return (
    <>
      {/* แชตกับลูกค้า — ฟองแก้วของ Joe นั่งในช่อง CHAT_SLOT (วาดในแคนวาส ไม่ใช่ DOM) */}
      <div ref={thread} className="ps-thread" style={{ visibility: 'hidden' }}>
        <div ref={zoomer} className="ps-zoom">
          {THREAD.map((m, i) => (
            <div
              key={i}
              ref={(el) => {
                rows.current[i] = el
              }}
              className={`ps-row ps-${m.who}`}
            >
              <div className="ps-row-in">
                {i === SLOT ? (
                  <div id={CHAT_SLOT_ID} ref={slot} className="ps-slot" />
                ) : (
                  <div
                    ref={(el) => {
                      msgs.current[i] = el
                    }}
                    className={`ps-msg${m.part ? ' ps-req' : ''}`}
                  >
                    <Marked text={m.text} keys={m.key} />
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={typing} className="ps-typing" style={{ visibility: 'hidden' }}>
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>

      {/* Design → Coding → Product: ในกรอบเนื้อหาของพาเนล */}
      <div ref={frame} className="ps-frame" style={{ visibility: 'hidden' }}>
        <div ref={grid} className="ps-grid" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        <div ref={page} className="ps-page">
          <header ref={part('nav')} className="ps-part ps-nav">
            <span className="ps-logo" />
            <span className="ps-links">
              <i>About</i>
              <i>Work</i>
              <i>Contact</i>
            </span>
          </header>
          <div className="ps-hero">
            <div className="ps-copy">
              <h3 ref={part('title')} className="ps-part ps-title">
                {HEADLINE}
              </h3>
              <span ref={part('cta')} className="ps-part ps-cta">
                Sign up
              </span>
            </div>
            <div ref={part('art')} className="ps-part ps-art">
              <span className="ps-art-sun" />
              <span className="ps-art-hill" />
            </div>
          </div>
          <div ref={part('cards')} className="ps-part ps-cards">
            {['#ffd8c2', '#d7e6ff', '#d9f3df'].map((c) => (
              <span key={c} style={{ '--c': c } as CSSProperties} />
            ))}
          </div>
          <div ref={live} className="ps-live">
            <span />
            Live
          </div>
        </div>
        <div ref={editor} className="ps-editor">
          <div className="ps-editor-bar">
            <span />
            <span />
            <span />
            <em>Home.tsx</em>
          </div>
          <ol>
            {CODE.map((c, i) => (
              <li key={c.part}>
                <span
                  ref={(el) => {
                    codeLines.current[i] = el
                  }}
                />
              </li>
            ))}
          </ol>
          <span ref={caret} className="ps-caret" />
        </div>
      </div>
    </>
  )
}
