import { Suspense, lazy, useRef, useState } from 'react'
import { SKILLS, STORY_ORDER } from '@/sections/whatido/WhatIDo'

/**
 * จอ "สิ่งที่ทำ" — ตัวละครยืนกลาง ขอบนอกแบ่งเป็นสามลิ่มตามสกิล
 *
 * ผังจาก wireframe (Figma BMS Design System · node 12799:2): สามลิ่มบรรจบกันที่จุดยอด
 * จุดเดียวเหนือหัวตัวละคร ลิ่มบนกินขอบบนทั้งแถบ ลิ่มซ้าย/ขวาลงไปถึงขอบล่าง เหลือช่องกลาง
 * ด้านล่างเป็นที่ยืนของตัวละคร — ตัวเลขข้างล่างถอดจากสัดส่วนในเฟรมนั้น
 *
 * ลิ่มเป็น DOM ไม่ใช่เรขาคณิตในฉาก: hover / โฟกัสคีย์บอร์ด / เครื่องอ่านหน้าจอได้ฟรีตาม
 * มาตรฐาน และตัวหนังสือเป็นข้อความจริงที่เลือกก็ได้ ค้นก็ได้ ตัวละคร 3D นั่งอยู่บนแคนวาส
 * โปร่งใสที่วางทับตรงกลาง (หัวหันตามเมาส์ด้วย screenFollow อยู่แล้ว — ชี้ลิ่มไหนมันมองตาม)
 *
 * การเปลี่ยนชุดตามลิ่มยังไม่ทำ (พักไว้ตามที่สั่ง) — ริกมีปุ่มให้เล่นแค่ลายเสื้อ/รองเท้า/แขน
 * lumberjack ส่วนสีเสื้อกางเกงยังเป็น const ระดับโมดูลใน Mascot.jsx ต้องเดินสายพร็อพเข้าไป
 * ก่อน ตอนนี้ hover จึงตอบด้วยการเน้นลิ่ม ขึ้นคำอธิบาย และเอียงตัวละครเข้าหาลิ่มนั้น
 */

/** mascot ตัวเดียวกับทั้งเว็บ — โหลดแยกก้อน จอนี้ไม่ได้อยู่บนสุดของหน้า */
const WedgeMascot = lazy(() =>
  import('./WedgeMascot').then((m) => ({ default: m.WedgeMascot })),
)

/**
 * จุดยอดที่ลิ่มทั้งสามบรรจบ (หน่วย % ของเฟรม) + ขอบของช่องกลางด้านล่าง
 *
 * จุดยอดอยู่เหนือหัวตัวละคร ไม่ใช่กลางเฟรมพอดี — ใน wireframe เส้นแบ่งสองเส้นวิ่งขึ้นไปหา
 * มุมบนซ้าย/ขวา และจุดตัดอยู่ราว 44% ของความสูง ซึ่งคือระดับไหล่ของตัวที่ยืนอยู่
 */
const APEX = { x: 50, y: 44 }
const FOOT_L = 38
const FOOT_R = 62

type Wedge = {
  /** รูปลิ่มในระบบ % ของเฟรม (ใช้เป็น clip-path ของปุ่มที่กินเต็มเฟรม) */
  clip: string
  /** ที่วางป้ายของลิ่มนั้น */
  label: string
  /** ทิศที่ตัวละครเอนไปเมื่อลิ่มนี้ถูกเลือก (องศา) */
  tilt: number
}

const WEDGES: Wedge[] = [
  {
    clip: `polygon(${APEX.x}% ${APEX.y}%, 0% 0%, 100% 0%)`,
    label: 'left-1/2 top-[clamp(56px,11svh,120px)] -translate-x-1/2 text-center',
    tilt: 0,
  },
  {
    clip: `polygon(${APEX.x}% ${APEX.y}%, 0% 0%, 0% 100%, ${FOOT_L}% 100%)`,
    label: 'left-[clamp(24px,5vw,72px)] top-1/2 -translate-y-1/2',
    tilt: -5,
  },
  {
    clip: `polygon(${APEX.x}% ${APEX.y}%, 100% 0%, 100% 100%, ${FOOT_R}% 100%)`,
    label: 'right-[clamp(24px,5vw,72px)] top-1/2 -translate-y-1/2 text-right',
    tilt: 5,
  },
]

/** ลำดับลิ่ม = ลำดับที่เรื่องเล่าถึง (Research → Design → Coding) ที่เดียวกับผังเดิม */
const BEATS = STORY_ORDER.map((i, n) => ({ ...SKILLS[i], wedge: WEDGES[n] }))

export function WhatIDoWedges({ id = 'what-i-do' }: { id?: string }) {
  /** ลิ่มที่กำลังถูกชี้/โฟกัส — null = สถานะพัก (ตัวละครยืนตรง ชุดกลาง) */
  const [at, setAt] = useState<number | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const active = at === null ? null : BEATS[at]

  return (
    <section
      id={id}
      data-screen={id}
      className="v2-theme relative h-[100svh] w-full overflow-clip bg-[var(--v2-bg)]"
    >
      {/* ── ลิ่มสามลิ่ม ────────────────────────────────────────────────────
          ปุ่มจริงที่กินเต็มเฟรมแล้วถูก clip เป็นรูปลิ่ม — clip-path ตัดทั้งภาพและการรับคลิก
          จึงไม่ต้องคิดลำดับการซ้อนหรือทำ hit-test เอง (เอาเมาส์ไปตรงไหนก็โดนลิ่มนั้นจริง) */}
      {BEATS.map((b, n) => {
        const on = at === n
        return (
          <button
            key={b.title}
            type="button"
            aria-pressed={on}
            onPointerEnter={() => setAt(n)}
            onPointerLeave={() => setAt((cur) => (cur === n ? null : cur))}
            onFocus={() => setAt(n)}
            onBlur={() => setAt((cur) => (cur === n ? null : cur))}
            className="absolute inset-0 cursor-pointer transition-[background-color] duration-300"
            style={{
              clipPath: b.wedge.clip,
              /* พื้นลิ่มตอนพักเป็นสีของสกิลที่จางมาก — ตอนถูกชี้ค่อยเข้มขึ้น ไม่ใช่เทาแล้วเด้ง
                 เป็นสีทันที (แบบนั้นตอนพักจอจะไม่มีสีเลย อ่านไม่ออกว่ามีสามส่วน) */
              /* พื้นจอนี้เกือบดำ (--v2-bg #0e1116) 7% จึงมองไม่เห็นว่ามีสามส่วน */
              backgroundColor: `color-mix(in srgb, ${b.color} ${on ? 30 : 11}%, transparent)`,
            }}
          >
            <span className="sr-only">{`${b.title} — ${b.desc}`}</span>
          </button>
        )
      })}

      {/* แสงวงกลมหลังตัวละคร — พื้นเกือบดำทั้งจอ ถ้าไม่มีอะไรรองตัวละครจะจมไปกับพื้น
          (ในภาพอ้างอิงของ kata ก็มีแสงวงนี้อยู่หลังตัว) */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[70svh] w-[70svh] -translate-x-1/2 -translate-y-[42%] rounded-full"
        style={{
          background: `radial-gradient(closest-side, color-mix(in srgb, ${
            active?.color ?? '#8fa0b4'
          } 26%, transparent), transparent)`,
          transition: 'background 400ms ease-out',
        }}
      />

      {/* เส้นแบ่งลิ่ม — วาดแยกจากปุ่ม เพราะขอบของ clip-path เป็นรอยตัดคม ไม่มีเส้นของตัวเอง */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <g stroke="var(--v2-line)" strokeWidth={0.12} opacity={0.7}>
          <line x1={APEX.x} y1={APEX.y} x2={0} y2={0} vectorEffect="non-scaling-stroke" />
          <line x1={APEX.x} y1={APEX.y} x2={100} y2={0} vectorEffect="non-scaling-stroke" />
          <line x1={APEX.x} y1={APEX.y} x2={FOOT_L} y2={100} vectorEffect="non-scaling-stroke" />
          <line x1={APEX.x} y1={APEX.y} x2={FOOT_R} y2={100} vectorEffect="non-scaling-stroke" />
        </g>
      </svg>

      {/* ── ตัวละครกลางจอ ─────────────────────────────────────────────────
          pointer-events-none: ลิ่มต้องรับเมาส์ตลอด ไม่ใช่ถูกแคนวาสกลางบังพื้นที่ชี้
          เอนตามลิ่มที่เลือกด้วย transform ของกรอบ ไม่ได้ไปยุ่งกับริกในฉาก */}
      <div
        ref={stage}
        className="pointer-events-none absolute bottom-0 left-1/2 h-[78%] w-[min(620px,52vw)] -translate-x-1/2 transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-50%) rotate(${active?.wedge.tilt ?? 0}deg)` }}
      >
        <Suspense fallback={null}>
          <WedgeMascot followRef={stage} />
        </Suspense>
      </div>

      {/* ── ป้ายของแต่ละลิ่ม ───────────────────────────────────────────── */}
      {BEATS.map((b, n) => {
        const on = at === n
        return (
          <div
            key={b.title}
            className={`pointer-events-none absolute max-w-[min(320px,28vw)] ${b.wedge.label}`}
          >
            <p
              className="text-[clamp(11px,1vw,13px)] tracking-[0.14em]"
              style={{ fontFamily: 'var(--v3-mono, ui-monospace)', color: b.color }}
            >
              {`0${n + 1}`}
            </p>
            <h3
              className="text-[clamp(20px,2.6vw,38px)] leading-tight"
              style={{ fontFamily: 'var(--v3-display)', color: on ? b.color : 'var(--v2-ink)' }}
            >
              {b.title}
            </h3>
            {/* คำอธิบายโผล่เฉพาะลิ่มที่ถูกชี้ — ขึ้นทั้งสามอันพร้อมกันจอจะเป็นกำแพงตัวหนังสือ
                ใช้ opacity ไม่ใช่ถอดโหนดออก ความสูงจึงไม่กระโดดตอนสลับ */}
            <p
              className="mt-2 text-[clamp(12px,1.1vw,15px)] leading-relaxed transition-opacity duration-300"
              /* --v2-ink-soft ไม่มีอยู่ในธีมนี้ ของเดิมเลยได้ค่าสำรอง #4a4f5a = เทาเข้ม
                 บนพื้นเกือบดำ อ่านไม่ออกเลย — หรี่จากสีหมึกของธีมแทน */
              style={{ opacity: on ? 1 : 0, color: 'color-mix(in srgb, var(--v2-ink) 68%, transparent)' }}
            >
              {b.desc}
            </p>
          </div>
        )
      })}

      <div className="pointer-events-none absolute bottom-[clamp(20px,4svh,40px)] left-1/2 -translate-x-1/2">
        <p className="v3-eyebrow">WHAT I DO</p>
      </div>
    </section>
  )
}
