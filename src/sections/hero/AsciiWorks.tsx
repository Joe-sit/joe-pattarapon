import { useEffect, useRef } from 'react'
import { WORKS } from './WorksGallery'
import { STORY_FONT, devScreen, smooth, worksPost, type WorkBeats } from './workMotion'

/**
 * Selected Work แบบ "ดูดเข้าจอ → compile ทีละงาน" — ต่อท้ายบท Code (POST_CODE = 'ascii' ใน ./workMotion)
 *
 *   ดูด     อักขระของคำ "Code" ที่สลาย หมุนวนเป็นก้นหอยรอบเครื่องแล้วถูกดูดเข้าจอ (WorkStory drawDissolve)
 *           จอเครื่องมืดลง เต็มไปด้วยฝนอักขระ (ชั้นนี้วาดทับจอเครื่องตามกรอบ devScreen ทุกเฟรม)
 *   เข้าจอ  เครื่องขยายจนจอคลุมทั้งหน้า (BubbleTraveler — rDolly) = กล้องพุ่งเข้าไปในจอ · ข้างในคือ terminal มืด
 *   compile งานทีละชิ้น (FEATURED): อักขระตกลงมาเรียงเป็นปกงาน (สีตามภาพจริง) → แสงสแกนกวาดลง เปลี่ยนเป็นภาพจริง
 *           (ภาษาเดียวกับแสงสแกนเติมสีตอนต้นบท Code) · บรรทัด `$ build ./ชื่องาน` พิมพ์ → `✓ compiled` + ชื่องาน
 *           เลื่อนต่อ = ชิ้นเดิมเลื่อนออกซ้าย ชิ้นถัดไปเริ่ม compile · แถบปกเล็กด้านล่างบอกว่า compile ไปถึงไหน
 *   ออก     จอหดกลับเข้าเครื่อง ฝนอักขระจาง ฉากมืดเปิดรูเป็นฟ้า (WorkStory) ต่อบท Ship
 *
 * ทั้งหมดตามระยะเลื่อน (worksPost) — เลื่อนกลับก็ถอยกลับ
 */
const FEATURED = WORKS.slice(0, 6)
const SLOT = 0.26
const P0 = 0.52

/** จังหวะ (worksPost) [เริ่ม, ยาว] */
const T = {
  fill: [-0.32, 0.42],
  dolly: [0.1, 0.38],
  title: [0.4, 0.24],
  projOut: [P0 + FEATURED.length * SLOT - 0.06, 0.12],
  undolly: [2.04, 0.2],
  unfill: [2.18, 0.12],
  open: [2.22, 0.18],
} as const
const at01 = (x: number, r: readonly [number, number]) => Math.min(1, Math.max(0, (x - r[0]) / r[1]))

export function asciiPhase(b: { code: number; works: number }) {
  const post = worksPost(b)
  const dolly = smooth(at01(post, T.dolly)) * (1 - smooth(at01(post, T.undolly)))
  return {
    post,
    /** จอเครื่องเป็นฝนอักขระ */
    fill: smooth(at01(post, T.fill)) * (1 - smooth(at01(post, T.unfill))),
    /** เครื่องขยายจนจอคลุมทั้งหน้า (1 = อยู่ในจอแล้ว) */
    dolly,
    /** ตำแหน่งในรายการงาน (0 → FEATURED.length) */
    proj: (post - P0) / SLOT,
    projVis: smooth(at01(post, [P0 - 0.1, 0.1])) * (1 - smooth(at01(post, T.projOut))),
    title: at01(post, T.title) * (1 - at01(post, T.projOut)),
    open: smooth(at01(post, T.open)),
    end: T.open[0] + T.open[1],
  }
}

const RAMP = ' .:-=+*#%@'
const NOISE = '01<>/\\{}[]=+*#%;:$&'
const hash = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return x - Math.floor(x)
}
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 22)

type Card = { img: HTMLImageElement; key: string; cols: number; rows: number; lvl: Uint8Array; rgb: Uint8Array }

/** ครอปภาพแบบ cover ลงกรอบ w×h (เอนบน) */
function coverRect(img: HTMLImageElement, w: number, h: number) {
  const a = img.naturalWidth / img.naturalHeight
  const b = w / h
  if (a > b) {
    const sw = img.naturalHeight * b
    return { sx: (img.naturalWidth - sw) / 2, sy: 0, sw, sh: img.naturalHeight }
  }
  const sh = img.naturalWidth / b
  return { sx: 0, sy: (img.naturalHeight - sh) / 4, sw: img.naturalWidth, sh }
}

/** ปก → ตารางอักขระ: เนื้อภาพ (เข้ม/สีอิ่ม) เป็นตัวหนา พื้นขาวเป็นจุดบาง · สีของช่อง (ยกสว่างนิดให้อ่านบนพื้นดำ) */
function sample(c: Card) {
  const cv = document.createElement('canvas')
  cv.width = c.cols
  cv.height = c.rows
  const g = cv.getContext('2d', { willReadFrequently: true })
  if (!g) return
  const r = coverRect(c.img, c.cols, c.rows)
  g.drawImage(c.img, r.sx, r.sy, r.sw, r.sh, 0, 0, c.cols, c.rows)
  const d = g.getImageData(0, 0, c.cols, c.rows).data
  for (let i = 0; i < c.cols * c.rows; i++) {
    const R = d[i * 4]
    const G = d[i * 4 + 1]
    const B = d[i * 4 + 2]
    const l = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255
    const sat = (Math.max(R, G, B) - Math.min(R, G, B)) / 255
    const ink = Math.min(1, (1 - l) * 1.1 + sat * 0.7)
    c.lvl[i] = Math.max(1, Math.round(ink * (RAMP.length - 1)))
    const lift = 0.3
    c.rgb[i * 3] = R + (255 - R) * lift
    c.rgb[i * 3 + 1] = G + (255 - G) * lift
    c.rgb[i * 3 + 2] = B + (255 - B) * lift
  }
}

export function AsciiWorks({ frame }: { frame: React.RefObject<{ on: boolean; b: WorkBeats }> }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const ui = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLDivElement>(null)
  const count = useRef<HTMLDivElement>(null)
  const cmd = useRef<HTMLSpanElement>(null)
  const done = useRef<HTMLSpanElement>(null)
  const name = useRef<HTMLDivElement>(null)
  const meta = useRef<HTMLDivElement>(null)
  const thumbs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    let raf = 0
    const imgs = FEATURED.map((w) => {
      const im = new Image()
      im.decoding = 'async'
      im.src = w.img
      return im
    })
    const cards: (Card | null)[] = FEATURED.map(() => null)
    const text = { title: '', count: '', cmd: '', name: '', meta: '' }
    const setText = (el: HTMLElement | null, k: keyof typeof text, v: string) => {
      if (!el || text[k] === v) return
      text[k] = v
      el.textContent = v
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const c = cv.current
      const rt = root.current
      const f = frame.current
      if (!c || !rt || !f) return
      const ph = asciiPhase(f.b)
      const vis = f.on && ph.fill > 0.002
      rt.style.visibility = vis ? 'visible' : 'hidden'
      if (!vis) return
      const W = window.innerWidth
      const H = window.innerHeight
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
        c.width = Math.round(W * dpr)
        c.height = Math.round(H * dpr)
      }
      const g = c.getContext('2d')
      if (!g) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)

      /* ── จอ: กรอบตามจอเครื่อง (ขยายจนคลุมทั้งหน้าตอนเข้าจอ) ── */
      const inset = 5
      const sx0 = devScreen.ok ? devScreen.cx - devScreen.hw + inset : 0
      const sy0 = devScreen.ok ? devScreen.cy - devScreen.hh + inset : 0
      const sw = devScreen.ok ? devScreen.hw * 2 - inset * 2 : W
      const sh = devScreen.ok ? devScreen.hh * 2 - inset * 2 : H
      const cover = ph.dolly > 0.999 || (sx0 <= 0 && sy0 <= 0 && sx0 + sw >= W && sy0 + sh >= H)
      g.save()
      g.globalAlpha = ph.fill
      g.beginPath()
      if (cover) g.rect(0, 0, W, H)
      else g.roundRect(sx0, sy0, sw, sh, Math.max(4, Math.min(devScreen.r - inset, sw / 2, sh / 2)))
      g.clip()
      g.fillStyle = '#07060d'
      g.fillRect(0, 0, W, H)
      /* แสงม่วงจาง ๆ ที่ก้นจอ (โทนเดียวกับฉาก Code) */
      const gl = g.createRadialGradient(W * 0.5, H * 1.05, 0, W * 0.5, H * 1.05, H * 0.9)
      gl.addColorStop(0, 'rgba(150,90,255,0.28)')
      gl.addColorStop(1, 'rgba(150,90,255,0)')
      g.fillStyle = gl
      g.fillRect(0, 0, W, H)

      /* ฝนอักขระ: คอลัมน์ตกลงไม่เท่ากัน (มืดลงตอนกำลัง compile ให้ปกเด่น) */
      const cell = 18
      const x0 = Math.max(0, cover ? 0 : sx0)
      const y0 = Math.max(0, cover ? 0 : sy0)
      const x1 = Math.min(W, cover ? W : sx0 + sw)
      const y1 = Math.min(H, cover ? H : sy0 + sh)
      const rainK = 1 - 0.55 * ph.projVis
      const t = now / 1000
      g.font = `600 ${cell - 4}px ${MONO}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      for (let x = Math.floor(x0 / cell) * cell; x < x1; x += cell) {
        const col = x / cell
        const speed = 3 + hash(col, 1) * 6
        const off = hash(col, 2) * 40
        for (let y = Math.floor(y0 / cell) * cell; y < y1; y += cell) {
          const row = y / cell
          const ph2 = (row - t * speed - off) % 28
          const tail = ph2 < 0 ? ph2 + 28 : ph2
          if (tail > 11) continue
          const a = (1 - tail / 11) * rainK * (tail < 0.9 ? 1 : 0.55)
          const head = tail < 0.9
          g.fillStyle = head ? `rgba(240,232,255,${a.toFixed(3)})` : `rgba(178,140,255,${(a * 0.7).toFixed(3)})`
          g.fillText(NOISE[Math.floor(hash(col * 31 + row, Math.floor(t * 8 + col)) * NOISE.length)], x + cell / 2, y + cell / 2)
        }
      }
      g.restore()

      /* ── compile งานทีละชิ้น (เฉพาะตอนอยู่ในจอแล้ว) ── */
      const pv = ph.projVis * (cover ? 1 : 0)
      const u = ui.current
      if (u) u.style.opacity = pv.toFixed(3)
      if (pv <= 0.001) return
      const cw = Math.min(W * 0.52, H * 0.6 * 1.6)
      const ch = cw / 1.6
      const ccx = W / 2
      const ccy = H * 0.45
      const pf = Math.max(0, Math.min(FEATURED.length - 1e-3, ph.proj))
      const cur = Math.floor(pf)
      const cols = 54
      const csz = cw / cols
      const rows = Math.max(4, Math.floor(ch / csz))
      for (let j = Math.max(0, cur - 1); j <= cur; j++) {
        const lt = ph.proj - j
        if (lt < 0 || lt > 1.14) continue
        const img = imgs[j]
        if (!img.complete || !img.naturalWidth) continue
        const key = `${cols}x${rows}`
        let cd = cards[j]
        if (!cd || cd.key !== key) {
          cd = { img, key, cols, rows, lvl: new Uint8Array(cols * rows), rgb: new Uint8Array(cols * rows * 3) }
          sample(cd)
          cards[j] = cd
        }
        const a = smooth(lt / 0.24)
        const scan = Math.min(1, Math.max(0, (lt - 0.24) / 0.36))
        /* ออก: เลื่อนไปซ้าย ย่อ จาง (ชิ้นถัดไปเริ่มประกอบตรงกลาง) */
        const o = smooth((lt - 0.88) / 0.26)
        const k = 1 - 0.35 * o
        const w = cw * k
        const h = rows * csz * k
        const x = ccx - w / 2 - o * W * 0.42
        const y = ccy - h / 2
        const cs = csz * k
        g.save()
        g.globalAlpha = pv * (1 - o)
        const scanY = y + h * scan
        if (scan > 0) {
          g.save()
          g.beginPath()
          g.roundRect(x, y, w, h, 10 * k)
          g.clip()
          g.beginPath()
          g.rect(x, y, w, scanY - y)
          g.clip()
          const r = coverRect(img, w, h)
          g.drawImage(img, r.sx, r.sy, r.sw, r.sh, x, y, w, h)
          g.restore()
        }
        g.font = `700 ${Math.max(6, Math.round(cs * 1.2))}px ${MONO}`
        const fs = Math.floor(now / 55)
        for (let i = 0; i < cols * rows; i++) {
          const ci = i % cols
          const ri = (i / cols) | 0
          const ty = y + (ri + 0.5) * cs
          if (scan > 0 && ty < scanY) continue
          const lvl = cd.lvl[i]
          /* อักขระตกจากฝนด้านบนลงช่องของตัวเอง ไม่พร้อมกัน */
          const pc = Math.min(1, Math.max(0, (a - hash(i, j) * 0.5) / 0.5))
          if (pc <= 0) continue
          const e = 1 - Math.pow(1 - pc, 3)
          const fy = ty - (1 - e) * (H * 0.25 + hash(i, j + 9) * H * 0.35)
          const fx = x + (ci + 0.5) * cs
          const near = scan > 0 && scan < 1 ? Math.max(0, 1 - (ty - scanY) / (cs * 4)) : 0
          const R = cd.rgb[i * 3] + (255 - cd.rgb[i * 3]) * near
          const G = cd.rgb[i * 3 + 1] + (255 - cd.rgb[i * 3 + 1]) * near
          const B = cd.rgb[i * 3 + 2] + (255 - cd.rgb[i * 3 + 2]) * near
          const al = Math.min(1, pc * 2) * (0.45 + 0.55 * (lvl / (RAMP.length - 1)) + near * 0.5)
          const chr = pc < 1 ? NOISE[Math.floor(hash(i, fs + j) * NOISE.length)] : RAMP[lvl]
          g.fillStyle = `rgba(${R | 0},${G | 0},${B | 0},${Math.min(1, al).toFixed(3)})`
          g.fillText(chr, fx, fy)
        }
        /* แสงสแกน: เส้นขาวเรือง + ฟุ้งม่วง เลยขอบปกนิด */
        if (scan > 0 && scan < 1) {
          const ext = w * 0.06
          const bg = g.createLinearGradient(0, scanY - 26, 0, scanY + 26)
          bg.addColorStop(0, 'rgba(190,150,255,0)')
          bg.addColorStop(0.5, 'rgba(210,180,255,0.55)')
          bg.addColorStop(1, 'rgba(190,150,255,0)')
          g.fillStyle = bg
          g.fillRect(x - ext, scanY - 26, w + ext * 2, 52)
          g.fillStyle = 'rgba(255,255,255,0.95)'
          g.fillRect(x - ext, scanY - 1, w + ext * 2, 2)
        }
        /* กรอบปกบาง ๆ ระหว่างประกอบ */
        if (scan < 1) {
          g.strokeStyle = `rgba(190,150,255,${(0.35 * a).toFixed(3)})`
          g.lineWidth = 1
          g.beginPath()
          g.roundRect(x, y, w, h, 10 * k)
          g.stroke()
        }
        g.restore()
      }

      /* ── ข้อความ: หัวเรื่อง · ตัวนับ · บรรทัด build · ชื่องาน · แถบปกเล็ก ── */
      const lt = ph.proj - cur
      const work = FEATURED[cur]
      const fsT = Math.floor(now / 55)
      const decode = (s: string, k: number) =>
        [...s]
          .map((chr, i) => {
            if (chr === ' ') return ' '
            const at = (i / s.length) * 0.7
            if (k >= at + 0.3) return chr
            if (k > at) return NOISE[Math.floor(hash(i, fsT) * NOISE.length)]
            return ' '
          })
          .join('')
      setText(title.current, 'title', decode('Selected Work', ph.title))
      setText(count.current, 'count', `${String(cur + 1).padStart(2, '0')} / ${String(FEATURED.length).padStart(2, '0')}`)
      const line = `$ build ./${slug(work.name)}`
      const typed = Math.round(Math.min(1, Math.max(0, lt / 0.22)) * line.length)
      setText(cmd.current, 'cmd', line.slice(0, typed) + (typed < line.length || Math.floor(now / 400) % 2 ? '▍' : ''))
      const ok = Math.min(1, Math.max(0, (lt - 0.58) / 0.1))
      if (done.current) done.current.style.opacity = ok.toFixed(3)
      setText(name.current, 'name', decode(work.name, Math.min(1, Math.max(0, (lt - 0.58) / 0.16))))
      setText(meta.current, 'meta', `${work.category} · ${work.sub}`)
      if (meta.current) meta.current.style.opacity = ok.toFixed(3)
      const out = smooth((lt - 0.88) / 0.12)
      if (u) {
        const capY = ccy + (rows * csz) / 2 + 22
        u.style.setProperty('--cap-y', `${capY.toFixed(0)}px`)
        u.style.setProperty('--cap-x', `${(ccx - cw / 2).toFixed(0)}px`)
        u.style.setProperty('--cap-o', (1 - out).toFixed(3))
      }
      thumbs.current.forEach((el, i) => {
        if (!el) return
        const compiled = ph.proj - i > 0.6
        el.dataset.state = compiled ? 'done' : i === cur ? 'cur' : 'todo'
      })
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [frame])

  return (
    <div ref={root} className="pointer-events-none absolute inset-0" style={{ visibility: 'hidden' }} aria-label="Selected Work">
      <canvas ref={cv} className="absolute inset-0 size-full" />
      <div ref={ui} className="absolute inset-0" style={{ opacity: 0 }}>
        <div className="absolute top-[9vh] left-[6vw] flex items-baseline gap-4">
          <div ref={title} className="text-[clamp(26px,3vw,52px)] leading-none font-bold tracking-[-0.04em] whitespace-pre text-white" style={{ fontFamily: STORY_FONT }} />
          <div ref={count} className="text-[13px] tracking-[0.12em] text-[#b48cff]" style={{ fontFamily: MONO }} />
        </div>
        {/* บรรทัด build + ชื่องาน ใต้ปกที่กำลัง compile */}
        <div className="absolute" style={{ left: 'var(--cap-x)', top: 'var(--cap-y)', opacity: 'var(--cap-o)' }}>
          <div className="flex items-center gap-3 text-[13px] text-[#c9b3ff]" style={{ fontFamily: MONO }}>
            <span ref={cmd} className="whitespace-pre" />
            <span ref={done} className="text-[#7dffb0]" style={{ opacity: 0 }}>
              ✓ compiled
            </span>
          </div>
          <div ref={name} className="mt-2 text-[clamp(18px,1.7vw,28px)] leading-tight font-bold tracking-[-0.02em] whitespace-pre text-white" style={{ fontFamily: STORY_FONT }} />
          <div ref={meta} className="mt-1 text-[12px] text-white/55" style={{ fontFamily: MONO, opacity: 0 }} />
        </div>
        {/* แถบปกเล็ก: compile แล้ว = ภาพ · กำลังทำ = กรอบม่วง · ยังไม่ถึง = จาง */}
        <div className="absolute bottom-[5vh] left-1/2 flex -translate-x-1/2 gap-2">
          {FEATURED.map((w, i) => (
            <div
              key={w.name}
              ref={(n) => {
                thumbs.current[i] = n
              }}
              className="h-[34px] w-[54px] overflow-hidden rounded-[5px] ring-1 ring-white/10 transition-[opacity,box-shadow,filter] duration-300 data-[state=cur]:opacity-100 data-[state=cur]:ring-2 data-[state=cur]:ring-[#b48cff] data-[state=done]:opacity-100 data-[state=todo]:opacity-25 data-[state=todo]:grayscale"
            >
              <img src={w.img} alt="" className="size-full object-cover object-top" draggable={false} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
