import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FaviconScene, loadFaviconSettings, type FaviconSettings } from './FaviconLab'

/**
 * ไอคอนซ้ายล่างของปกโปรไฟล์ Fastwork (./FastworkProfile) = favicon ตัวจริงแบบสด
 *
 * ใช้ฉากเดียวกับหน้า /favicon-lab ทุกชิ้น (FaviconScene) กับค่าที่จูนไว้ในหน้านั้น (localStorage) — หัว มุมกล้อง เส้นแสง
 * เงาซ้อน สี ตรงกับ favicon ทุกค่า
 *
 * ท่าเข้า (ทีละอย่าง นุ่ม ไม่เด้ง): การ์ด (พื้น + มุมมนของ favicon) ขยายขึ้นมาก่อน → หัวหมุนหนึ่งรอบโผล่ในการ์ด → เงาซ้อน (echo) งอกทีละชั้น
 * ท่าออก = ย้อนลำดับ · อ่านนาฬิกาเดียวกับแบนเนอร์ (clock)
 */

type Props = { clock: { t0: number; len: number }; at: number; outAt: number; className?: string }

/** ขนาดแคนวาสของหน้า /favicon-lab */
const LAB = 512
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
/** ease-out quint — เข้านุ่ม ไม่เด้ง */
const outQuint = (x: number) => 1 - Math.pow(1 - x, 5)

const C1 = new THREE.Color()
const C2 = new THREE.Color()
/** ความเร็วไหลของสี echo ตอน idle (ชั้นต่อวินาที) */
const FLOW = 0.55
/* จังหวะ (วินาทีหลัง at / outAt) */
const CARD_IN = 0.9
const HEAD_AT = 0.3
const HEAD_IN = 1.4
const ECHO_AT = 1.3
const ECHO_STEP = 0.18
const OUT_ECHO_STEP = 0.07
const OUT_HEAD_AT = 0.35
const OUT_HEAD = 0.5
const OUT_CARD_AT = 0.7
const OUT_CARD = 0.35

function Driver({ s, n, clock, at, outAt, spin, card, body, palette, phase0 }: Omit<Props, 'className'> & { s: FaviconSettings; n: number; spin: React.RefObject<THREE.Group | null>; card: React.RefObject<HTMLDivElement | null>; body: React.RefObject<THREE.Object3D[] | null>; palette: string[]; phase0: number }) {
  useFrame(({ camera }) => {
    const tc = ((performance.now() - clock.t0) / 1000) % clock.len
    const out = tc >= outAt
    const to = tc - outAt
    /* การ์ด */
    const kc = out ? 1 - clamp01((to - OUT_CARD_AT) / OUT_CARD) ** 2 : outQuint(clamp01((tc - at) / CARD_IN))
    const el = card.current
    if (el) {
      el.style.transform = `scale(${Math.max(0, kc).toFixed(4)})`
      el.style.visibility = kc > 0.002 ? 'visible' : 'hidden'
    }
    /*
     * หัว: หมุนหนึ่งรอบ โตจากเล็ก — ทำด้วยกล้อง (โคจรรอบจุดเล็ง + ถอยไกล) ไม่แตะตัวละคร
     * (ห่อตัวละครด้วยกลุ่มที่หมุน/ย่อ ทำให้ท่าหัวเพี้ยนจากที่จูน — ตัวละครคิดท่าหัวจากพิกัดโลกของมันเอง)
     */
    const kh = out ? 1 - clamp01((to - OUT_HEAD_AT) / OUT_HEAD) ** 2 : outQuint(clamp01((tc - at - HEAD_AT) / HEAD_IN))
    const yaw = s.yaw + Math.PI * 2 * (1 - Math.min(1, kh))
    const dist = s.dist / Math.max(0.05, 0.15 + 0.85 * kh)
    camera.position.set(
      s.tx + dist * Math.sin(yaw) * Math.cos(s.pitch),
      s.ty + dist * Math.sin(s.pitch),
      s.tz + dist * Math.cos(yaw) * Math.cos(s.pitch),
    )
    camera.lookAt(s.tx, s.ty, s.tz)
    const g = spin.current
    if (g) {
      g.visible = kh > 0.002
      /* เอาแค่หัว: ซ่อนทุกชิ้นของตัวละครที่ไม่อยู่ใต้ HeadGroup (ตอนกล้องถอยไกลจะเห็นตัว) — หาครั้งเดียวหลังโมเดลโหลด */
      if (!body.current) {
        let head: THREE.Object3D | null = null
        g.traverse((o) => {
          if (o.name === 'HeadGroup') head = o
        })
        if (head) {
          const keep = new Set<THREE.Object3D>()
          ;(head as THREE.Object3D).traverse((o) => keep.add(o))
          const list: THREE.Object3D[] = []
          g.traverse((o) => {
            if ((o as THREE.Mesh).isMesh && !keep.has(o)) list.push(o)
          })
          body.current = list
        }
      }
      body.current?.forEach((o) => {
        o.visible = false
      })
    }
    /*
     * idle = echo loop: หลังชั้นครบ สีไหลออกจากหัวไปขอบนอกช้า ๆ ต่อเนื่อง (ชั้นที่ k รับสีจากชั้นด้านในทีละน้อย ผสมนุ่ม)
     * และขอบชั้นเป็นคลื่นเลื่อนเฟสช้า ๆ — วนไม่รู้จบ ชั้นในสุดรับสีวนกลับจากชั้นนอกสุด
     */
    const idleT = tc - at - ECHO_AT - ECHO_STEP * n
    if (idleT > 0 && !out) {
      const shift = idleT * FLOW
      for (let k = 0; k < n; k++) {
        const f = (((k - shift) % n) + n) % n
        const a = Math.floor(f)
        C1.set(palette[a]).lerp(C2.set(palette[(a + 1) % n]), f - a)
        s.colors[k] = `#${C1.getHexString()}`
      }
      s.phase = phase0 + idleT * 0.35
    } else {
      for (let k = 0; k < n; k++) s.colors[k] = palette[k]
      s.phase = phase0
    }
    /* echo ทีละชั้น (ใกล้หัว → ไกล) · ออก: หุบจากไกลเข้ามา */
    s.echoN = out ? Math.max(0, n - Math.floor(clamp01(to / (OUT_ECHO_STEP * n)) * n + 0.0001)) : Math.min(n, Math.max(0, Math.floor((tc - at - ECHO_AT) / ECHO_STEP) + 1))
  })
  return null
}

export function FastworkHead3D({ clock, at, outAt, className }: Props) {
  /* สำเนาค่าที่จูนไว้ — แก้ echoN ในนี้ทุกเฟรม (ฉากอ่านเองในเฟรม) ไม่กระทบหน้า /favicon-lab */
  const s = useMemo(() => {
    const v = loadFaviconSettings()
    return { ...v, colors: [...v.colors] }
  }, [])
  const n = useMemo(() => Math.min(8, s.echoN, s.colors.length), [s])
  /* สีชุดเดิม (ก่อนไหล) — s.colors ถูกแก้ทุกเฟรมตอน idle */
  const palette = useMemo(() => [...s.colors], [s])
  const phase0 = s.phase
  const spin = useRef<THREE.Group>(null)
  const card = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const body = useRef<THREE.Object3D[] | null>(null)
  /* ย่อแคนวาส 512 ให้พอดีกล่องไอคอน (ขนาดในอาร์ตบอร์ด ก่อน CSS scale ของอาร์ตบอร์ด) */
  useLayoutEffect(() => {
    const el = inner.current
    const box = el?.parentElement
    if (!el || !box) return
    el.style.setProperty('--k', String(box.offsetWidth / LAB))
  }, [])
  return (
    <div className={className} aria-hidden>
      <div ref={card} className="size-full overflow-hidden" style={{ borderRadius: `${(s.radius * 100).toFixed(1)}%`, visibility: 'hidden' }}>
        {/*
         * วาดที่ขนาดเดียวกับหน้า lab (512 px, dpr 1) แล้วย่อด้วย CSS — เส้นแสงขอบ/ความกว้าง echo เป็นหน่วยพิกเซลของแคนวาส
         * ถ้าวาดที่ขนาดจริงของไอคอน (78 px) ทุกอย่างหนาผิดสัดส่วน หัวจึงไม่เหมือน favicon
         */}
        <div style={{ width: LAB, height: LAB, transform: 'scale(var(--k))', transformOrigin: '0 0' }} ref={inner}>
          <Canvas resize={{ offsetSize: true }} dpr={1} gl={{ antialias: true }} camera={{ fov: s.fov, near: 0.05, far: 60 }}>
            <FaviconScene s={s} spin={spin} />
            <Driver s={s} n={n} clock={clock} at={at} outAt={outAt} spin={spin} card={card} body={body} palette={palette} phase0={phase0} />
          </Canvas>
        </div>
      </div>
    </div>
  )
}
